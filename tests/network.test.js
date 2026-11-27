/**
 * Socket-level tests against servers on 127.0.0.1.
 * The SSRF guard (correctly) refuses loopback, so these call the low-level functions
 * directly with a pre-pinned address to exercise real HTTP and TLS connections.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import tls from "node:tls";
import { gradeCertificate, inspectCertificate } from "../lib/scanner/checks/ssl.js";
import { requestOnce } from "../lib/scanner/safe-request.js";

const LOOPBACK = { address: "127.0.0.1", family: 4 };
let server;
let port;
let seenHeaders;

const target = (path = "/") => ({
  protocol: "http:",
  hostname: "public-site.example",
  port,
  pathname: path,
  search: "",
  isIpHost: false,
  ipVersion: 0,
});

before(async () => {
  server = http.createServer((request, response) => {
    seenHeaders = request.headers;
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
      response.end();
    } else if (request.url === "/huge") {
      response.writeHead(200, { "Content-Type": "text/html" });
      const chunk = "a".repeat(64 * 1024);
      let sent = 0;
      const pump = () => {
        while (sent < 200 && response.write(chunk)) sent += 1;
        if (sent < 200 && !response.destroyed) response.once("drain", pump);
        else response.end();
      };
      pump();
    } else if (request.url === "/slow") {
      // never answers
    } else {
      response.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": "session=abc" });
      response.end("<title>hello</title>");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test("requestOnce connects to the pinned address, not to whatever the hostname resolves to", async () => {
  // "public-site.example" does not exist in DNS; the request only succeeds because of pinning.
  const response = await requestOnce(target("/"), LOOPBACK);
  assert.equal(response.status, 200);
  assert.equal(response.body, "<title>hello</title>");
  assert.equal(response.remoteAddress, "127.0.0.1");
  assert.equal(seenHeaders.host, `public-site.example:${port}`);
});

test("requestOnce sends no cookies or credentials and asks for uncompressed content", async () => {
  await requestOnce(target("/"), LOOPBACK);
  assert.equal(seenHeaders.cookie, undefined);
  assert.equal(seenHeaders.authorization, undefined);
  assert.equal(seenHeaders["accept-encoding"], "identity");
  assert.match(seenHeaders["user-agent"], /ScamShieldBot/);
});

test("requestOnce never follows redirects by itself", async () => {
  const response = await requestOnce(target("/redirect"), LOOPBACK);
  assert.equal(response.status, 302);
  assert.equal(response.headers.location, "http://169.254.169.254/latest/meta-data/");
});

test("requestOnce stops reading at the response size limit", async () => {
  const response = await requestOnce(target("/huge"), LOOPBACK, { maxBytes: 100_000 });
  assert.equal(response.truncated, true);
  assert.equal(response.body.length, 100_000);
});

test("requestOnce times out on servers that never answer", async () => {
  await assert.rejects(requestOnce(target("/slow"), LOOPBACK, { timeoutMs: 300 }), (error) => error.code === "timeout");
});

test("inspectCertificate reads an untrusted certificate and grades it as invalid", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ss-cert-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"), "-days", "2", "-subj", "/CN=wrong-name.test"], { stdio: "ignore" });
  const tlsServer = tls.createServer({ key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) }, (socket) => socket.end());
  await new Promise((resolve) => tlsServer.listen(0, "127.0.0.1", resolve));
  try {
    const cert = await inspectCertificate({ hostname: "bank.example", isIpHost: false }, LOOPBACK, { port: tlsServer.address().port });
    assert.equal(cert.authorized, false);
    assert.equal(cert.subject, "wrong-name.test");
    assert.equal(cert.hostnameMismatch, true);
    assert.ok(cert.validTo instanceof Date);
    const findings = gradeCertificate(cert);
    assert.equal(findings[0].code, "ssl-invalid");
  } finally {
    tlsServer.close();
  }
});

test("inspectCertificate rejects when nothing is listening", async () => {
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const closedPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  await assert.rejects(inspectCertificate({ hostname: "x.example", isIpHost: false }, LOOPBACK, { port: closedPort }), (error) => error.code === "ECONNREFUSED");
});
