import { isIP } from "node:net";
import { domainToUnicode } from "node:url";
import { parse as parseDomain } from "tldts";
import { blockedReason } from "./ip-guard.js";

export const MAX_URL_LENGTH = 2048;

/** Only web ports are scannable. This stops the scanner being used as an internal port prober. */
export const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

const INTERNAL_SUFFIXES = [
  "localhost", "local", "localdomain", "internal", "intranet", "lan", "home", "corp", "private",
  "home.arpa", "in-addr.arpa", "ip6.arpa", "test", "example", "invalid", "onion",
];

/** Thrown when input cannot or must not be scanned. `message` is safe to show to users. */
export class ScanInputError extends Error {
  constructor(message, code = "invalid_url") {
    super(message);
    this.name = "ScanInputError";
    this.code = code;
  }
}

/**
 * Validate and normalize a user-supplied (or redirect-supplied) URL.
 * Returns a plain descriptor; throws ScanInputError when the URL is not scannable.
 */
export function normalizeUrl(input) {
  if (typeof input !== "string") throw new ScanInputError("Enter a website address to scan.");
  let raw = input.trim();
  if (!raw) throw new ScanInputError("Enter a website address to scan.");
  if (raw.length > MAX_URL_LENGTH) {
    throw new ScanInputError(`That address is too long (${MAX_URL_LENGTH.toLocaleString("en")} characters max).`);
  }
  if (/[\s\u0000-\u001F\u007F]/.test(raw)) {
    throw new ScanInputError("A website address cannot contain spaces or control characters.");
  }
  if (raw.includes("\\")) {
    throw new ScanInputError("A website address cannot contain backslashes.");
  }

  const hadScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (!hadScheme) {
    if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(raw)) {
      throw new ScanInputError("Only http:// and https:// addresses can be scanned.", "unsupported_scheme");
    }
    raw = `https://${raw}`;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ScanInputError("That does not look like a valid website address.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScanInputError("Only http:// and https:// addresses can be scanned.", "unsupported_scheme");
  }

  // Credentials embedded in a URL are a classic deception trick. Record it, then strip them
  // so that nothing resembling a credential is ever sent to the scanned site.
  const hadCredentials = Boolean(url.username || url.password);
  url.username = "";
  url.password = "";
  url.hash = "";

  let hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (!hostname) throw new ScanInputError("That address has no domain name.");

  const bareHost = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
  const ipVersion = isIP(bareHost);
  const isIpHost = ipVersion !== 0;

  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new ScanInputError(
      `Port ${port} cannot be scanned. Only standard web ports (80, 443, 8080, 8443) are allowed.`,
      "blocked_port",
    );
  }

  let registrableDomain = null;
  let publicSuffix = null;
  let subdomain = "";
  let domainWithoutSuffix = null;

  if (isIpHost) {
    const reason = blockedReason(bareHost);
    if (reason) {
      throw new ScanInputError(
        `That address points to ${reason}. Only public websites can be scanned.`,
        "blocked_address",
      );
    }
  } else {
    if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.length > 253) {
      throw new ScanInputError("That domain name contains invalid characters.");
    }
    if (hostname.split(".").some((label) => !label || label.length > 63)) {
      throw new ScanInputError("That domain name is not valid.");
    }
    if (!hostname.includes(".")) {
      throw new ScanInputError("Enter a full public domain, like example.com.", "blocked_address");
    }
    if (INTERNAL_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
      throw new ScanInputError(
        "That is an internal or reserved hostname. Only public websites can be scanned.",
        "blocked_address",
      );
    }
    const parsed = parseDomain(hostname, { allowPrivateDomains: false });
    if (!parsed.domain || !parsed.isIcann) {
      throw new ScanInputError("That does not look like a public domain name.", "blocked_address");
    }
    registrableDomain = parsed.domain;
    publicSuffix = parsed.publicSuffix;
    subdomain = parsed.subdomain || "";
    domainWithoutSuffix = parsed.domainWithoutSuffix;
  }

  url.hostname = hostname;

  return {
    href: url.href,
    protocol: url.protocol,
    hostname: bareHost,
    unicodeHostname: isIpHost ? bareHost : domainToUnicode(hostname) || hostname,
    port,
    pathname: url.pathname,
    search: url.search,
    isIpHost,
    ipVersion,
    registrableDomain,
    publicSuffix,
    subdomain,
    domainWithoutSuffix,
    hadScheme,
    hadCredentials,
  };
}
