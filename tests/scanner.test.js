import assert from "node:assert/strict";
import { test } from "node:test";
import { checkContent, inspectHtml } from "../lib/scanner/checks/content.js";
import { checkHttpResponse, checkRedirects, checkShortener } from "../lib/scanner/checks/http.js";
import * as reputation from "../lib/scanner/checks/reputation.js";
import {
  calendarAge,
  checkDomainRegistration,
  describeAge,
  fetchRdap,
  gradeRegistration,
  parseBootstrap,
  parseRdapDomain,
  parseRetryAfter,
  pickRdapServer,
  queryRegistry,
} from "../lib/scanner/checks/rdap.js";
import { checkSsl, gradeCertificate } from "../lib/scanner/checks/ssl.js";
import { checkImpersonation, editDistance, findImpersonation, normalizeLookalikes } from "../lib/scanner/checks/typosquat.js";
import { analyzeUrl, checkUrlPatterns } from "../lib/scanner/checks/url-patterns.js";
import { blockedReason, isBlockedAddress } from "../lib/scanner/ip-guard.js";
import { followRedirects, pinnedLookup, resolvePublicAddresses } from "../lib/scanner/safe-request.js";
import { normalizeUrl, ScanInputError } from "../lib/scanner/url.js";
import { levelForScore } from "../lib/scoring/levels.js";
import { buildRecommendations } from "../lib/scoring/recommendations.js";
import { scoreChecks, summarizeCoverage } from "../lib/scoring/risk-score.js";

const DAY = 86_400_000;
const codes = (findings) => findings.map((finding) => finding.code);

/* ---------- URL validation and SSRF guard ---------- */

test("normalizeUrl adds https and extracts the registrable domain", () => {
  const target = normalizeUrl("  Shop.Example.co.uk/path?q=1#frag ");
  assert.equal(target.href, "https://shop.example.co.uk/path?q=1");
  assert.equal(target.registrableDomain, "example.co.uk");
  assert.equal(target.subdomain, "shop");
  assert.equal(target.hadScheme, false);
  assert.equal(target.port, 443);
});

test("normalizeUrl strips embedded credentials and records them", () => {
  const target = normalizeUrl("https://paypal.com@evil-site.io/login");
  assert.equal(target.hostname, "evil-site.io");
  assert.equal(target.hadCredentials, true);
  assert.ok(!target.href.includes("@"));
});

test("normalizeUrl rejects unsupported schemes and malformed input", () => {
  for (const bad of ["", "   ", "javascript:alert(1)", "file:///etc/passwd", "ftp://example.com", "gopher://example.com", "http://exa mple.com", "https://", "data:text/html,hi", "http:\\\\example.com"]) {
    assert.throws(() => normalizeUrl(bad), ScanInputError, `should reject ${JSON.stringify(bad)}`);
  }
});

test("normalizeUrl blocks localhost, private, reserved and obfuscated addresses", () => {
  const blocked = [
    "http://localhost",
    "http://localhost:8080/admin",
    "http://app.localhost",
    "http://127.0.0.1",
    "http://127.1",
    "http://2130706433", // decimal 127.0.0.1
    "http://0x7f.0.0.1", // hex
    "http://017700000001", // octal
    "http://0.0.0.0",
    "http://10.0.0.5",
    "http://172.16.4.1",
    "http://192.168.1.1",
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://100.64.0.1",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://[::ffff:7f00:1]",
    "http://[fe80::1]",
    "http://[fd00::1]",
    "http://printer.local",
    "http://db.internal",
    "http://intranet",
    "http://service.corp",
  ];
  for (const url of blocked) {
    assert.throws(() => normalizeUrl(url), ScanInputError, `should block ${url}`);
  }
});

test("normalizeUrl only allows web ports", () => {
  assert.throws(() => normalizeUrl("http://example.com:22"), /Port 22/);
  assert.throws(() => normalizeUrl("http://example.com:6379"), /Port 6379/);
  assert.equal(normalizeUrl("http://example.com:8080").port, 8080);
});

test("normalizeUrl accepts public IPs and enforces the length limit", () => {
  assert.equal(normalizeUrl("http://93.184.216.34").isIpHost, true);
  assert.throws(() => normalizeUrl(`https://example.com/${"a".repeat(2100)}`), /too long/);
});

test("ip guard classifies public and non-public addresses", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "169.254.169.254", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fe80::abcd", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2001:db8::1", "not-an-ip"]) {
    assert.equal(isBlockedAddress(address), true, `${address} should be blocked`);
  }
  for (const address of ["8.8.8.8", "93.184.216.34", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "2a00:1450:4001::200e"]) {
    assert.equal(blockedReason(address), null, `${address} should be allowed`);
  }
});

test("resolvePublicAddresses rejects hosts with ANY private record (DNS rebinding defence)", async () => {
  const target = normalizeUrl("https://rebind.example.com");
  const mixed = async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ];
  await assert.rejects(resolvePublicAddresses(target, { lookup: mixed }), ScanInputError);

  const metadata = async () => [{ address: "169.254.169.254", family: 4 }];
  await assert.rejects(resolvePublicAddresses(target, { lookup: metadata }), /link-local/);

  const fine = async () => [{ address: "93.184.216.34", family: 4 }];
  assert.deepEqual(await resolvePublicAddresses(target, { lookup: fine }), [{ address: "93.184.216.34", family: 4 }]);
});

test("resolvePublicAddresses reports DNS failure without throwing ScanInputError", async () => {
  const target = normalizeUrl("https://nope.example.com");
  const failing = async () => {
    const error = new Error("getaddrinfo ENOTFOUND");
    error.code = "ENOTFOUND";
    throw error;
  };
  await assert.rejects(resolvePublicAddresses(target, { lookup: failing }), (error) => error.code === "dns_failure");
});

test("pinnedLookup always answers with the vetted address in both callback styles", () => {
  const lookup = pinnedLookup({ address: "93.184.216.34", family: 4 });
  lookup("anything.example", {}, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, "93.184.216.34");
    assert.equal(family, 4);
  });
  lookup("anything.example", { all: true }, (error, list) => {
    assert.deepEqual(list, [{ address: "93.184.216.34", family: 4 }]);
  });
});

/* ---------- Redirect following ---------- */

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function fakeRequest(routes) {
  return async (target, pinned) => {
    const route = routes[target.href];
    if (!route) throw Object.assign(new Error("refused"), { code: "ECONNREFUSED" });
    return { status: route.status, headers: route.headers || {}, body: route.body || "", truncated: false, remoteAddress: pinned.address };
  };
}

test("followRedirects follows a chain and records each hop", async () => {
  const request = fakeRequest({
    "http://example.com/": { status: 301, headers: { location: "https://example.com/" } },
    "https://example.com/": { status: 302, headers: { location: "/home" } },
    "https://example.com/home": { status: 200, headers: { "content-type": "text/html" }, body: "<title>Hi</title>" },
  });
  const chain = await followRedirects(normalizeUrl("http://example.com"), { lookup: publicLookup, request });
  assert.equal(chain.hops.length, 3);
  assert.equal(chain.final.target.href, "https://example.com/home");
  assert.equal(chain.error, null);
  assert.equal(chain.blocked, null);
});

test("followRedirects refuses redirects to internal targets", async () => {
  for (const location of ["http://169.254.169.254/latest/meta-data/", "http://localhost:8080/", "http://[::1]/", "file:///etc/passwd", "http://example.com:22/"]) {
    const request = fakeRequest({ "https://evil.example.com/": { status: 302, headers: { location } } });
    const chain = await followRedirects(normalizeUrl("https://evil.example.com"), { lookup: publicLookup, request });
    assert.equal(chain.final, null, location);
    assert.ok(chain.blocked, `should block redirect to ${location}`);
    assert.equal(chain.hops.length, 1);
  }
});

test("followRedirects blocks a public-looking hop whose DNS answers with a private address", async () => {
  const request = fakeRequest({ "https://start.example.com/": { status: 302, headers: { location: "https://internal.attacker.net/" } } });
  const lookup = async (hostname) =>
    hostname === "internal.attacker.net" ? [{ address: "10.0.0.8", family: 4 }] : [{ address: "93.184.216.34", family: 4 }];
  const chain = await followRedirects(normalizeUrl("https://start.example.com"), { lookup, request });
  assert.ok(chain.blocked);
  assert.match(chain.blocked.reason, /private network/);
  const check = checkRedirects(chain, normalizeUrl("https://start.example.com"));
  assert.ok(codes(check.findings).includes("redirect-blocked"));
});

test("followRedirects stops after the redirect limit", async () => {
  const request = async (target, pinned) => ({
    status: 302,
    headers: { location: `https://loop.example.com/${Math.random().toString(36).slice(2)}` },
    body: "",
    truncated: false,
    remoteAddress: pinned.address,
  });
  const chain = await followRedirects(normalizeUrl("https://loop.example.com"), { lookup: publicLookup, request, maxRedirects: 3 });
  assert.equal(chain.error.code, "too_many_redirects");
  assert.equal(chain.hops.length, 4);
});

test("redirect check flags HTTPS to HTTP downgrades and cross-domain hops", async () => {
  const request = fakeRequest({
    "https://a-site.com/": { status: 302, headers: { location: "https://b-site.net/x" } },
    "https://b-site.net/x": { status: 302, headers: { location: "http://c-site.org/" } },
    "http://c-site.org/": { status: 200, headers: {}, body: "ok" },
  });
  const input = normalizeUrl("https://a-site.com");
  const chain = await followRedirects(input, { lookup: publicLookup, request });
  const check = checkRedirects(chain, input);
  assert.ok(codes(check.findings).includes("redirect-downgrade"));
  assert.ok(codes(check.findings).includes("redirect-cross-domain"));
});

test("an unreachable site yields unavailable checks, not passes", async () => {
  const input = normalizeUrl("https://down.example.com");
  const chain = await followRedirects(input, { lookup: publicLookup, request: fakeRequest({}) });
  assert.equal(checkHttpResponse(chain).status, "unavailable");
  assert.equal(checkRedirects(chain, input).status, "unavailable");
  assert.equal(checkContent(chain).status, "unavailable");
});

test("shortener check reveals the destination", async () => {
  const request = fakeRequest({
    "https://bit.ly/abc": { status: 301, headers: { location: "https://real-destination.com/" } },
    "https://real-destination.com/": { status: 200, headers: {}, body: "" },
  });
  const input = normalizeUrl("https://bit.ly/abc");
  const chain = await followRedirects(input, { lookup: publicLookup, request });
  const check = checkShortener(input, chain);
  assert.equal(check.findings[0].code, "shortener");
  assert.match(check.summary, /real-destination\.com/);
  assert.equal(checkShortener(normalizeUrl("https://example.com"), chain).status, "pass");
});

/* ---------- URL patterns ---------- */

test("url patterns: clean URL has no findings", () => {
  assert.deepEqual(analyzeUrl(normalizeUrl("https://www.wikipedia.org/wiki/Phishing")), []);
});

test("url patterns: flags IP hosts, credentials, punycode, keywords, TLD tricks", () => {
  assert.ok(codes(analyzeUrl(normalizeUrl("http://93.184.216.34/login"))).includes("ip-host"));
  assert.ok(codes(analyzeUrl(normalizeUrl("https://user:pw@example.com"))).includes("embedded-credentials"));
  assert.ok(codes(analyzeUrl(normalizeUrl("https://xn--pypal-4ve.com"))).includes("punycode"));
  const stacked = codes(analyzeUrl(normalizeUrl("https://secure-login-verify-account.top")));
  assert.ok(stacked.includes("host-keywords"));
  assert.ok(stacked.includes("abused-tld"));
  assert.ok(stacked.includes("many-hyphens"));
  assert.ok(codes(analyzeUrl(normalizeUrl("https://paypal.com-secure.xyz"))).includes("tld-in-name"));
  assert.ok(codes(analyzeUrl(normalizeUrl("https://www.paypal.com.account.evil.io"))).includes("tld-in-name"));
  assert.ok(codes(analyzeUrl(normalizeUrl("https://example.com/update/setup.exe"))).includes("risky-download"));
});

test("url patterns check includes destination findings", () => {
  const check = checkUrlPatterns(normalizeUrl("https://example.com"), normalizeUrl("http://93.184.216.34/"));
  assert.ok(check.findings.some((finding) => finding.code === "ip-host" && finding.label.startsWith("Destination:")));
});

/* ---------- Typosquatting ---------- */

test("edit distance and look-alike normalization", () => {
  assert.equal(editDistance("paypal", "paypal"), 0);
  assert.equal(editDistance("paypall", "paypal"), 1);
  assert.equal(editDistance("gogole", "google"), 1); // transposition
  assert.equal(normalizeLookalikes("paypa1"), "paypal");
  assert.equal(normalizeLookalikes("arnazon"), "amazon");
  assert.equal(normalizeLookalikes("g00gle"), "google");
});

test("impersonation: official domains pass", () => {
  for (const url of ["https://www.paypal.com/signin", "https://accounts.google.com", "https://www.amazon.in", "https://login.microsoftonline.com", "https://github.com"]) {
    const check = checkImpersonation(normalizeUrl(url));
    assert.equal(check.status, "pass", url);
    assert.equal(check.findings.length, 0, url);
  }
});

test("impersonation: detects typos, homoglyphs, combos and subdomain tricks", () => {
  const kind = (url) => findImpersonation(normalizeUrl(url)).matches[0]?.kind;
  assert.equal(kind("https://paypa1.com"), "homoglyph");
  assert.equal(kind("https://arnazon.com"), "homoglyph");
  assert.equal(kind("https://paypall.com"), "typo");
  assert.equal(kind("https://gooogle.com"), "typo");
  assert.equal(kind("https://micros0ft-support.com"), "combined");
  assert.equal(kind("https://paypal-secure-login.com"), "combined");
  assert.equal(kind("https://netflixbilling.net"), "combined");
  assert.equal(kind("https://paypal.com.account-check.io"), "subdomain");
  assert.equal(kind("https://paypal.xyz"), "different-tld");
  assert.equal(checkImpersonation(normalizeUrl("https://paypa1.com")).status, "fail");
});

test("impersonation: ordinary words and unrelated domains are not flagged", () => {
  for (const url of ["https://finance.example.org", "https://email.com", "https://pineapple.com", "https://purchase.com", "https://wikipedia.org", "https://looking.com", "https://twister.com", "https://myblog.dev", "https://groups.io", "https://snapple.com"]) {
    assert.deepEqual(findImpersonation(normalizeUrl(url)).matches, [], url);
  }
});

test("impersonation: everyday-word brands score low", () => {
  const match = findImpersonation(normalizeUrl("https://hotel-booking.com")).matches[0];
  assert.equal(match.brand, "Booking.com");
  assert.ok(match.points <= 10);
});

/* ---------- Registration and certificates ---------- */

test("rdap parsing and age grading", () => {
  const now = Date.parse("2026-06-01T00:00:00Z");
  const info = parseRdapDomain({
    events: [
      { eventAction: "registration", eventDate: "2026-05-28T10:00:00Z" },
      { eventAction: "expiration", eventDate: "2027-05-28T10:00:00Z" },
    ],
    entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Example Registrar LLC"]]] }],
    status: ["client transfer prohibited"],
  });
  assert.equal(info.registrar, "Example Registrar LLC");
  const fresh = gradeRegistration(info, now);
  assert.equal(fresh.findings[0].code, "domain-new");
  assert.equal(fresh.findings[0].points, 18);

  const old = gradeRegistration({ registered: new Date(now - 3000 * DAY), expires: new Date(now + 300 * DAY), statuses: [] }, now);
  assert.deepEqual(old.findings, []);

  const held = gradeRegistration({ registered: new Date(now - 50 * DAY), expires: null, statuses: ["client hold"] }, now);
  assert.deepEqual(codes(held.findings), ["domain-young", "domain-hold"]);

  assert.equal(gradeRegistration({ registered: null, expires: null, statuses: [] }, now).ageDays, null);
});

test("calendarAge counts real calendar months and years", () => {
  const age = (from, to) => calendarAge(new Date(from), new Date(to));
  assert.deepEqual(age("2022-08-15T00:00:00Z", "2026-11-20T00:00:00Z"), { years: 4, months: 3, days: 5, totalDays: 1558 });
  assert.equal(describeAge(age("2022-08-15T00:00:00Z", "2026-11-20T00:00:00Z")), "4 years and 3 months");
  // Month-end rollover: 31 Jan to 1 Mar is one month and one day, not a "30-day month".
  assert.deepEqual(age("2026-01-31T00:00:00Z", "2026-03-01T00:00:00Z"), { years: 0, months: 1, days: 1, totalDays: 29 });
  assert.equal(describeAge(age("2025-11-27T00:00:00Z", "2026-11-27T00:00:00Z")), "1 year");
  assert.equal(describeAge(age("2026-11-20T00:00:00Z", "2026-11-27T00:00:00Z")), "7 days");
  assert.equal(describeAge(age("2026-11-27T10:00:00Z", "2026-11-27T12:00:00Z")), "less than a day");
  // A registration date in the future (clock skew) never produces a negative age.
  assert.equal(age("2027-01-01T00:00:00Z", "2026-11-27T00:00:00Z").totalDays, 0);
});

test("registry lookup: bootstrap parsing and longest-suffix server choice", () => {
  const map = parseBootstrap({
    services: [
      [["com", "net"], ["https://rdap.verisign.com/com/v1/"]],
      [["uk"], ["https://rdap.nominet.uk/uk"]],
      [["co.uk"], ["https://example-registry.test/rdap/"]],
      [["bad"], ["http://insecure.example/"]],
      [["ip"], ["https://10.0.0.1/"]],
    ],
  });
  assert.equal(pickRdapServer(map, "github.com"), "https://rdap.verisign.com/com/v1/");
  assert.equal(pickRdapServer(map, "bbc.co.uk"), "https://example-registry.test/rdap/");
  assert.equal(pickRdapServer(map, "example.uk"), "https://rdap.nominet.uk/uk/");
  assert.equal(pickRdapServer(map, "example.bad"), null, "plain http registries are refused");
  assert.equal(pickRdapServer(map, "example.ip"), null, "IP-address registries are refused");
  assert.equal(pickRdapServer(map, "example.unknown"), null);
});

const target = (domain) => normalizeUrl(`https://${domain}`);
const rdapOk = (events, extra = {}) => async () => ({ ok: true, status: 200, server: "rdap.test", data: { events, ...extra } });

test("registration check: an established domain passes and exposes structured facts", async () => {
  const now = Date.parse("2026-11-27T00:00:00Z");
  const result = await checkDomainRegistration(target("example.com"), {
    now,
    query: rdapOk(
      [
        { eventAction: "registration", eventDate: "2022-08-15T00:00:00Z" },
        { eventAction: "expiration", eventDate: "2027-08-15T00:00:00Z" },
        { eventAction: "last changed", eventDate: "2026-01-02T00:00:00Z" },
      ],
      { entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["fn", {}, "text", "Good Registrar Inc."]]] }], status: ["client transfer prohibited"] },
    ),
  });
  assert.equal(result.status, "pass");
  assert.equal(result.data.ageText, "4 years and 3 months");
  assert.equal(result.data.registrar, "Good Registrar Inc.");
  assert.equal(result.data.registered, "2022-08-15T00:00:00.000Z");
  assert.equal(result.data.expires, "2027-08-15T00:00:00.000Z");
  assert.equal(result.data.updated, "2026-01-02T00:00:00.000Z");
  assert.equal(result.findings.length, 0);
});

test("registration check: a newly registered domain warns but is not called malicious", async () => {
  const now = Date.parse("2026-11-27T00:00:00Z");
  const result = await checkDomainRegistration(target("brand-new.com"), {
    now,
    query: rdapOk([{ eventAction: "registration", eventDate: "2026-11-23T00:00:00Z" }]),
  });
  assert.equal(result.status, "warn");
  assert.equal(result.data.ageText, "4 days");
  assert.ok(result.findings.every((finding) => finding.points < 35));
});

test("registration check: every failure becomes unavailable with no points and no invented dates", async () => {
  // [response, phrase, lookup failed (rescan) vs data not published]
  const cases = [
    [{ ok: false, reason: "network", attempts: 3 }, "could not be reached after 3 attempts", true],
    [{ ok: false, reason: "timeout", attempts: 2 }, "did not answer in time", true],
    [{ ok: false, reason: "http", status: 503, attempts: 3 }, "HTTP 503", true],
    [{ ok: false, reason: "bad-response", status: 200 }, "could not be read", true],
    [{ ok: false, status: 429 }, "limiting requests", true],
    [{ ok: false, reason: "unsupported" }, "does not offer a public RDAP", false],
    [{ ok: false, status: 404 }, "no public record", false],
    [{ ok: false, status: 404, reason: "not-found", via: "redirector" }, "may not offer RDAP", false],
    [{ ok: true, status: 200, data: { events: [{ eventAction: "expiration", eventDate: "2027-01-01T00:00:00Z" }] }, server: "rdap.test" }, "does not include a registration date", false],
  ];
  for (const [response, phrase, failed] of cases) {
    const result = await checkDomainRegistration(target("example.com"), { query: async () => response });
    assert.equal(result.status, "unavailable", phrase);
    const lead = failed ? "Registration lookup failed." : "Registration date unavailable.";
    assert.ok(result.summary.startsWith(lead), result.summary);
    assert.ok(result.summary.includes(phrase), `${phrase} :: ${result.summary}`);
    assert.equal(result.data.lookupFailed, failed, phrase);
    assert.equal(result.findings.length, 0);
    assert.equal(result.data.registered ?? null, null);
  }
  // A query that throws is a failed lookup, never a crash or a pass.
  const thrown = await checkDomainRegistration(target("example.com"), { query: async () => { throw new Error("boom"); } });
  assert.equal(thrown.status, "unavailable");
  assert.equal(thrown.data.lookupFailed, true);
});

/* ---------- RDAP transport: retries, rate limits, fallbacks ---------- */

const reply = (status, data = null, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  data,
  headers: new Headers(headers),
  url: "https://rdap.test/domain/example.com",
});
const scripted = (steps) => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return step;
  };
  return { fetcher, calls };
};
const noSleep = async () => {};
const timeoutError = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

test("fetchRdap retries transient failures and stops as soon as the registry answers", async () => {
  const { fetcher, calls } = scripted([timeoutError(), reply(503), reply(200, { ldhName: "EXAMPLE.COM", events: [] })]);
  const result = await fetchRdap("https://rdap.test/domain/example.com", { fetcher, sleep: noSleep });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.options.timeoutMs <= 4000 && call.options.timeoutMs >= 1000), "every attempt has a bounded timeout");
});

test("fetchRdap never retries a 404 and reports the last failure after the retry limit", async () => {
  const notFound = scripted([reply(404)]);
  const missing = await fetchRdap("https://rdap.test/x", { fetcher: notFound.fetcher, sleep: noSleep });
  assert.equal(missing.reason, "not-found");
  assert.equal(notFound.calls.length, 1);

  const down = scripted([new TypeError("fetch failed")]);
  const failed = await fetchRdap("https://rdap.test/x", { fetcher: down.fetcher, sleep: noSleep });
  assert.equal(failed.reason, "network");
  assert.equal(failed.attempts, 3);

  const forbidden = scripted([reply(403)]);
  const refused = await fetchRdap("https://rdap.test/x", { fetcher: forbidden.fetcher, sleep: noSleep });
  assert.equal(refused.reason, "http");
  assert.equal(forbidden.calls.length, 1);
});

test("fetchRdap honours a short Retry-After and gives up on a long one", async () => {
  const waits = [];
  const short = scripted([reply(429, null, { "Retry-After": "1" }), reply(200, { ldhName: "EXAMPLE.COM" })]);
  const ok = await fetchRdap("https://rdap.test/x", { fetcher: short.fetcher, sleep: async (ms) => waits.push(ms) });
  assert.equal(ok.ok, true);
  assert.deepEqual(waits, [1000]);

  const long = scripted([reply(429, null, { "Retry-After": "120" })]);
  const limited = await fetchRdap("https://rdap.test/x", { fetcher: long.fetcher, sleep: noSleep });
  assert.equal(limited.reason, "rate-limited");
  assert.equal(long.calls.length, 1, "does not keep hammering a registry that asked us to wait");

  assert.equal(parseRetryAfter("3"), 3000);
  assert.equal(parseRetryAfter(new Date(Date.parse("2026-01-01T00:00:05Z")).toUTCString(), Date.parse("2026-01-01T00:00:00Z")), 5000);
  assert.equal(parseRetryAfter("soon"), null);
});

test("fetchRdap respects the overall deadline and treats RDAP error bodies as not found", async () => {
  const { fetcher, calls } = scripted([reply(200, { ldhName: "X" })]);
  const expired = await fetchRdap("https://rdap.test/x", { fetcher, sleep: noSleep, deadline: Date.now() + 200 });
  assert.equal(expired.ok, false);
  assert.equal(expired.reason, "timeout");
  assert.equal(calls.length, 0);

  const errorBody = scripted([reply(200, { errorCode: 404, title: "Not Found" })]);
  assert.equal((await fetchRdap("https://rdap.test/x", { fetcher: errorBody.fetcher, sleep: noSleep })).reason, "not-found");
});

test("queryRegistry: unsupported only when the full IANA list lacks the extension; otherwise uses the rdap.org redirector", async () => {
  const servers = new Map([["com", "https://rdap.verisign.com/com/v1/"]]);
  const { fetcher, calls } = scripted([reply(200, { ldhName: "EXAMPLE.IO" })]);

  const unsupported = await queryRegistry("example.io", { fetcher, sleep: noSleep, loadServers: async () => ({ map: servers, complete: true }) });
  assert.equal(unsupported.reason, "unsupported");
  assert.equal(calls.length, 0);

  const viaRedirector = await queryRegistry("example.io", { fetcher, sleep: noSleep, loadServers: async () => ({ map: servers, complete: false }) });
  assert.equal(viaRedirector.via, "redirector");
  assert.equal(calls[0].url, "https://rdap.org/domain/example.io");

  await queryRegistry("GitHub.com", { fetcher, sleep: noSleep, loadServers: async () => ({ map: servers, complete: true }) });
  assert.equal(calls[1].url, "https://rdap.verisign.com/com/v1/domain/github.com");
});

test("rdap parsing: earliest registration, latest expiry and last change, registrar org fallback", () => {
  const info = parseRdapDomain({
    events: [
      { eventAction: "last update of RDAP database", eventDate: "2026-11-27T00:00:00Z" },
      { eventAction: "registration", eventDate: "2010-05-01T00:00:00Z" },
      { eventAction: "registration", eventDate: "2007-10-09T18:20:50Z" },
      { eventAction: "expiration", eventDate: "2028-10-09T18:20:50Z" },
      { eventAction: "last changed", eventDate: "2026-09-07T09:22:52Z" },
      { eventAction: "registration", eventDate: "not a date" },
    ],
    entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["fn", {}, "text", ""], ["org", {}, "text", "MarkMonitor Inc."]]] }],
  });
  assert.equal(info.registered.toISOString(), "2007-10-09T18:20:50.000Z");
  assert.equal(info.expires.toISOString(), "2028-10-09T18:20:50.000Z");
  assert.equal(info.updated.toISOString(), "2026-09-07T09:22:52.000Z", "the RDAP database timestamp is not the domain's update");
  assert.equal(info.registrar, "MarkMonitor Inc.");

  const empty = parseRdapDomain(null);
  assert.equal(empty.registered, null);
  assert.equal(empty.registrar, null);
});

test("registration check: privacy-protected records are noted, not penalised", async () => {
  const result = await checkDomainRegistration(target("example.com"), {
    now: Date.parse("2026-11-27T00:00:00Z"),
    query: rdapOk([{ eventAction: "registration", eventDate: "2015-01-01T00:00:00Z" }], { remarks: [{ description: ["REDACTED FOR PRIVACY"] }] }),
  });
  assert.equal(result.data.privacyProtected, true);
  assert.equal(result.status, "pass");
});

test("certificate grading: valid certificates earn zero points, never a bonus", () => {
  const now = Date.now();
  const valid = { authorized: true, hostnameMismatch: false, protocol: "TLSv1.3", validFrom: new Date(now - 30 * DAY), validTo: new Date(now + 60 * DAY) };
  assert.deepEqual(gradeCertificate(valid, now), []);
  assert.equal(gradeCertificate({ ...valid, validTo: new Date(now - DAY) }, now)[0].code, "ssl-invalid");
  assert.equal(gradeCertificate({ ...valid, hostnameMismatch: true }, now)[0].code, "ssl-invalid");
  assert.equal(gradeCertificate({ ...valid, authorized: false, authorizationError: "DEPTH_ZERO_SELF_SIGNED_CERT" }, now)[0].points, 25);
});

test("ssl check: refused connection is a finding, timeout is unavailable", async () => {
  const target = normalizeUrl("http://example.com");
  const addresses = [{ address: "93.184.216.34", family: 4 }];
  const refused = await checkSsl(target, addresses, { inspect: async () => { throw Object.assign(new Error("x"), { code: "ECONNREFUSED" }); } });
  assert.equal(refused.findings[0].code, "ssl-missing");
  const timedOut = await checkSsl(target, addresses, { inspect: async () => { throw Object.assign(new Error("x"), { code: "timeout" }); } });
  assert.equal(timedOut.status, "unavailable");
  assert.equal((await checkSsl(target, [])).status, "unavailable");
});

/* ---------- Content ---------- */

test("content inspection finds brand login pages and external form targets", () => {
  const target = normalizeUrl("https://secure-account-check.top/signin");
  const html = `<html><head><title>PayPal: Log in</title></head><body>
    <form action="https://collector.badhost.ru/save.php" method="post"><input type="email"><input type="password" name="p"></form>
    <script>alert('never executed')</script></body></html>`;
  const { findings, facts } = inspectHtml(html, target);
  assert.equal(facts.hasPasswordField, true);
  assert.deepEqual(facts.externalFormTargets, ["badhost.ru"]);
  assert.ok(codes(findings).includes("form-external"));
  assert.ok(codes(findings).includes("brand-login-page"));

  const legit = inspectHtml(`<title>Log in to your PayPal account</title><form action="/signin"><input type="password"></form>`, normalizeUrl("https://www.paypal.com/signin"));
  assert.deepEqual(legit.findings, []);

  const plainHttp = inspectHtml(`<form><input type=password></form>`, normalizeUrl("http://some-forum.org/login"));
  assert.ok(codes(plainHttp.findings).includes("password-over-http"));
});

/* ---------- Scoring ---------- */

const check = (id, status, points = [], core = false) => ({
  id,
  title: id,
  core,
  status,
  findings: points.map((value, index) => ({ code: `${id}-${index}`, label: `${id} finding`, points: value })),
});

test("score thresholds map to the four levels", () => {
  assert.equal(levelForScore(0).id, "safe");
  assert.equal(levelForScore(14).id, "safe");
  assert.equal(levelForScore(15).id, "low");
  assert.equal(levelForScore(34).id, "low");
  assert.equal(levelForScore(35).id, "suspicious");
  assert.equal(levelForScore(64).id, "suspicious");
  assert.equal(levelForScore(65).id, "high");
  assert.equal(levelForScore(250).id, "high");
});

test("a clean scan with valid HTTPS scores 0, and HTTPS never lowers a score", () => {
  const clean = scoreChecks([check("ssl", "pass", [], true), check("dns", "pass", [], true), check("url-patterns", "pass")]);
  assert.equal(clean.score, 0);
  assert.equal(clean.level, "safe");

  const phishingWithHttps = scoreChecks([check("ssl", "pass", [], true), check("impersonation", "fail", [40]), check("domain-age", "fail", [35], true)]);
  const phishingNoSslInfo = scoreChecks([check("impersonation", "fail", [40]), check("domain-age", "fail", [35], true)]);
  assert.equal(phishingWithHttps.score, phishingNoSslInfo.score);
  assert.equal(phishingWithHttps.level, "high");
});

test("unavailable checks add no risk points and are never counted as passed", () => {
  const result = scoreChecks([
    check("domain-age", "unavailable", [], true),
    check("ssl", "unavailable", [], true),
    check("dns", "unavailable", [], true),
    check("http", "unavailable", [], true),
    check("ip", "unavailable"),
    check("url-patterns", "pass"),
  ]);
  assert.equal(result.score, 0);
  assert.equal(result.breakdown.length, 0);
  // Only the main checks are counted: http and ip are technical context.
  assert.deepEqual(result.coverage, { total: 4, completed: 1, passed: 1, warnings: 0, unavailable: ["domain-age", "ssl", "dns"] });
});

test("coverage counts warnings (including failures), passes and unavailable separately", () => {
  const coverage = summarizeCoverage([
    check("domain-age", "warn", [10], true),
    check("ssl", "pass", [], true),
    check("impersonation", "fail", [40]),
    check("dns", "unavailable", [], true),
    check("safe-browsing", "pass"),
    check("http", "warn", [3]),
  ]);
  assert.deepEqual(coverage, { total: 5, completed: 4, passed: 2, warnings: 2, unavailable: ["dns"] });
});

test("legacy skipped results are excluded from coverage", () => {
  const result = scoreChecks([check("safe-browsing", "skipped"), check("ssl", "pass", [], true)]);
  assert.equal(result.score, 0);
  assert.equal(result.coverage.total, 1);
});

test("the same finding reported by two checks is scored once", () => {
  const dup = (id) => ({ id, title: id, core: false, status: "warn", findings: [{ code: "brand-homoglyph", label: "x", points: 30 }] });
  const result = scoreChecks([dup("impersonation"), dup("content")]);
  assert.equal(result.score, 30);
  assert.equal(result.breakdown.length, 1);
});

test("a very young domain on its own is a caution, never a Suspicious verdict", () => {
  const newest = gradeRegistration({ registered: new Date(Date.now() - 1 * DAY), expires: null, statuses: [] });
  const result = scoreChecks([{ id: "domain-age", title: "x", core: true, status: "warn", findings: newest.findings }]);
  assert.ok(result.score > 0 && result.score < 35, `score was ${result.score}`);
  assert.notEqual(result.level, "suspicious");
});

test("optional VirusTotal without a key is unavailable, adds no risk and stays out of the totals", async () => {
  const vt = await reputation.checkVirusTotal("https://example.com/", "");
  assert.equal(vt.status, "unavailable");
  assert.equal(vt.findings.length, 0);
  assert.equal(vt.data.optional, true);
  const passed = (id) => ({ id, title: id, core: false, status: "pass", findings: [] });
  const main = ["domain-age", "ssl", "safe-browsing", "dns", "url-patterns", "impersonation", "redirects", "content"].map(passed);
  const withVt = scoreChecks([...main, vt]);
  const without = scoreChecks(main);
  assert.equal(withVt.score, without.score);
  assert.deepEqual(withVt.coverage, without.coverage);
});

test("an unconfigured Safe Browsing key is unavailable, not a pass", async () => {
  const result = await reputation.checkSafeBrowsing(["https://example.com/"], "");
  assert.equal(result.status, "unavailable");
  assert.equal(result.findings.length, 0);
});

test("per-check cap and total clamp", () => {
  const capped = scoreChecks([check("url-patterns", "fail", [25, 20, 15, 12])]);
  assert.equal(capped.score, 45);
  assert.equal(capped.breakdown[0].capped, true);
  const listed = scoreChecks([check("safe-browsing", "fail", [80]), check("impersonation", "fail", [40]), check("domain-age", "fail", [35], true)]);
  assert.equal(listed.score, 100);
});

test("recommendations match the findings and level", () => {
  const scoring = scoreChecks([{ id: "impersonation", title: "x", core: false, status: "fail", findings: [{ code: "brand-homoglyph", label: "x", points: 40 }] }]);
  const advice = buildRecommendations(scoring.level, scoring.breakdown, []);
  assert.ok(advice.some((line) => line.includes("letter by letter")));
  assert.ok(advice.some((line) => line.includes("Do not enter passwords")));
});
