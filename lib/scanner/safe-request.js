import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { blockedReason } from "./ip-guard.js";
import { normalizeUrl, ScanInputError } from "./url.js";

export const USER_AGENT = "Mozilla/5.0 (compatible; ScamShieldBot/1.0; website safety scan)";
export const MAX_REDIRECTS = 5;
export const MAX_BODY_BYTES = 256 * 1024;
export const REQUEST_TIMEOUT_MS = 7000;

/** Default resolver: the OS resolver, returning every address for the name. */
function systemLookup(hostname) {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
}

/**
 * Resolve a hostname and refuse it if ANY returned address is private or reserved.
 * Rejecting on any (not all) defeats DNS answers that mix public and internal records.
 * Returns the vetted addresses; callers must connect to these exact addresses (see pinnedLookup).
 */
export async function resolvePublicAddresses(target, { lookup = systemLookup } = {}) {
  if (target.isIpHost) {
    // Already vetted by normalizeUrl, but check again: this function is the last line of defence.
    const reason = blockedReason(target.hostname);
    if (reason) throw new ScanInputError(`The address points to ${reason}.`, "blocked_address");
    return [{ address: target.hostname, family: target.ipVersion }];
  }

  let records;
  try {
    records = await withTimeout(lookup(target.hostname), 4000, "DNS lookup timed out");
  } catch (error) {
    const failure = new Error(
      error?.code === "ENOTFOUND" || error?.code === "EAI_NONAME"
        ? "The domain name does not resolve to any address."
        : error?.message || "DNS lookup failed.",
    );
    failure.code = "dns_failure";
    throw failure;
  }

  if (!Array.isArray(records) || records.length === 0) {
    const failure = new Error("The domain name does not resolve to any address.");
    failure.code = "dns_failure";
    throw failure;
  }

  for (const record of records) {
    const reason = blockedReason(record.address);
    if (reason) {
      throw new ScanInputError(
        `${target.hostname} resolves to ${record.address}, which is ${reason}. Only public websites can be scanned.`,
        "blocked_address",
      );
    }
  }
  return records.map((record) => ({ address: record.address, family: record.family }));
}

/**
 * A `lookup` implementation that always answers with one pre-vetted address.
 * Passing this to http(s).request pins the connection to the IP we validated, so a second
 * DNS answer (DNS rebinding) cannot redirect the socket to an internal host.
 */
export function pinnedLookup({ address, family }) {
  return (_hostname, options, callback) => {
    const cb = typeof options === "function" ? options : callback;
    if (typeof options === "object" && options?.all) cb(null, [{ address, family }]);
    else cb(null, address, family);
  };
}

/**
 * Perform exactly one HTTP(S) request to a vetted address. Never follows redirects,
 * never sends cookies or credentials, and reads at most `maxBytes` of the body.
 */
export function requestOnce(target, pinned, { timeoutMs = REQUEST_TIMEOUT_MS, maxBytes = MAX_BODY_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = target.protocol === "https:";
    const transport = isHttps ? https : http;
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const request = transport.request(
      {
        protocol: target.protocol,
        host: target.hostname,
        port: target.port,
        path: `${target.pathname || "/"}${target.search || ""}`,
        method: "GET",
        agent: false,
        lookup: pinnedLookup(pinned),
        // The certificate is graded separately by the SSL check; here we only observe the response.
        rejectUnauthorized: false,
        servername: isHttps && !target.isIpHost ? target.hostname : undefined,
        headers: {
          Host: hostHeader(target, isHttps),
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en",
          // No compression: keeps the byte limit meaningful and avoids decompression bombs.
          "Accept-Encoding": "identity",
          Connection: "close",
        },
      },
      (response) => {
        const chunks = [];
        let received = 0;
        let truncated = false;

        const done = () => {
          finish(resolve, {
            status: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
            truncated,
            remoteAddress: pinned.address,
          });
        };

        response.on("data", (chunk) => {
          if (truncated) return;
          const room = maxBytes - received;
          if (chunk.length >= room) {
            chunks.push(chunk.subarray(0, room));
            received = maxBytes;
            truncated = true;
            done();
            request.destroy();
            return;
          }
          chunks.push(chunk);
          received += chunk.length;
        });
        response.on("end", done);
        response.on("error", () => done());
      },
    );

    const timer = setTimeout(() => {
      const error = new Error("The website took too long to respond.");
      error.code = "timeout";
      request.destroy(error);
      finish(reject, error);
    }, timeoutMs);

    request.on("error", (error) => finish(reject, error));
    request.end();
  });
}

/**
 * Follow a redirect chain manually, re-validating every hop (scheme, port, hostname and
 * resolved addresses) before connecting. Never throws for network failures; the outcome
 * is described in the returned object so that checks can report "unavailable".
 */
export async function followRedirects(startTarget, options = {}) {
  const { maxRedirects = MAX_REDIRECTS, lookup, request = requestOnce } = options;
  const hops = [];
  let current = startTarget;
  let final = null;
  let error = null;
  let blocked = null;

  for (let index = 0; index <= maxRedirects; index += 1) {
    let addresses;
    try {
      addresses = await resolvePublicAddresses(current, { lookup });
    } catch (failure) {
      if (failure instanceof ScanInputError) blocked = { url: current.href, reason: failure.message };
      else error = { url: current.href, code: failure.code || "dns_failure", message: failure.message };
      break;
    }

    let response;
    try {
      response = await request(current, addresses[0]);
    } catch (failure) {
      error = { url: current.href, code: failure.code || "request_failed", message: describeNetworkError(failure) };
      break;
    }

    const location = headerValue(response.headers.location);
    const isRedirect = response.status >= 300 && response.status < 400 && Boolean(location);
    hops.push({
      url: current.href,
      hostname: current.hostname,
      registrableDomain: current.registrableDomain,
      protocol: current.protocol,
      status: response.status,
      ip: response.remoteAddress,
      location: isRedirect ? location : null,
    });

    if (!isRedirect) {
      final = { target: current, addresses, response };
      break;
    }

    if (index === maxRedirects) {
      error = { url: current.href, code: "too_many_redirects", message: `Stopped after ${maxRedirects} redirects.` };
      break;
    }

    try {
      current = normalizeUrl(new URL(location, current.href).href);
    } catch (failure) {
      const reason = failure instanceof ScanInputError ? failure.message : "The redirect target is not a valid URL.";
      blocked = { url: String(location).slice(0, 300), reason };
      break;
    }
  }

  return { hops, final, error, blocked };
}

function hostHeader(target, isHttps) {
  const name = target.ipVersion === 6 ? `[${target.hostname}]` : target.hostname;
  return target.port === (isHttps ? 443 : 80) ? name : `${name}:${target.port}`;
}

export function headerValue(value) {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

export function describeNetworkError(error) {
  switch (error?.code) {
    case "timeout":
    case "ETIMEDOUT":
      return "The website took too long to respond.";
    case "ECONNREFUSED":
      return "The server refused the connection.";
    case "ECONNRESET":
    case "EPIPE":
      return "The server closed the connection unexpectedly.";
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "The domain name could not be resolved.";
    case "EHOSTUNREACH":
    case "ENETUNREACH":
      return "The server could not be reached.";
    default:
      return error?.message ? `Connection failed: ${String(error.message).slice(0, 140)}` : "Connection failed.";
  }
}

export function withTimeout(promise, ms, message = "Timed out") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.code = "timeout";
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** fetch() JSON from a fixed, trusted API host (IANA bootstrap, RDAP registries, Safe Browsing) with a timeout. */
export async function fetchJson(url, { timeoutMs = 6000, headers, ...init } = {}) {
  // Always identify ourselves: some public APIs (rdap.org sits behind Cloudflare) answer 403 to
  // Node's default "User-Agent: node". A caller's own User-Agent still wins.
  const response = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  // `url` is where fetch ended up after redirects (for example rdap.org forwarding to a registry).
  return { ok: response.ok, status: response.status, data, headers: response.headers, url: response.url };
}
