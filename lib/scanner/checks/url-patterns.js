import { HIGH_ABUSE_TLDS, RISKY_EXTENSIONS, SUSPICIOUS_KEYWORDS } from "../data/lists.js";
import { makeCheck } from "./check.js";

const ID = "url-patterns";
const TITLE = "Suspicious URL patterns";

/** Pure analysis of one URL descriptor (from normalizeUrl). Returns findings only. */
export function analyzeUrl(target) {
  const findings = [];
  const host = target.hostname;
  const sld = target.domainWithoutSuffix || "";
  const pathAndQuery = `${target.pathname || ""}${target.search || ""}`.toLowerCase();

  if (target.isIpHost) {
    findings.push({
      code: "ip-host",
      label: "The address uses a raw IP number instead of a domain name",
      points: 25,
    });
  }

  if (target.hadCredentials) {
    findings.push({
      code: "embedded-credentials",
      label: "The address contains an '@' sign with embedded user info, a trick used to disguise the real destination",
      points: 20,
    });
  }

  if (!target.isIpHost && host.split(".").some((label) => label.startsWith("xn--"))) {
    findings.push({
      code: "punycode",
      label: `The domain uses internationalized characters (shown as ${target.unicodeHostname}), which can imitate other letters`,
      points: 15,
    });
  }

  const subdomainLabels = target.subdomain ? target.subdomain.split(".").filter(Boolean) : [];
  if (subdomainLabels.length >= 3) {
    findings.push({
      code: "deep-subdomains",
      label: `The address has ${subdomainLabels.length} subdomain levels, which can bury the real domain`,
      points: 8,
    });
  }

  // "paypal.com-secure.xyz" or "www.paypal.com.evil.io": a TLD-looking label in the wrong place.
  const tldLookalike = /(^|[.-])(com|net|org|gov|edu|co)([.-]|$)/;
  if (!target.isIpHost && (tldLookalike.test(target.subdomain || "") || /(^|-)(com|net|org|gov)(-|$)/.test(sld))) {
    findings.push({
      code: "tld-in-name",
      label: "The name contains something that looks like a domain ending (such as 'com') in the wrong position",
      points: 12,
    });
  }

  if (host.length > 50) {
    findings.push({ code: "long-host", label: `Unusually long hostname (${host.length} characters)`, points: 5 });
  }
  if (target.href.length > 200) {
    findings.push({ code: "long-url", label: `Unusually long address (${target.href.length} characters)`, points: 4 });
  }

  const hyphens = (sld.match(/-/g) || []).length;
  if (hyphens >= 3) {
    findings.push({ code: "many-hyphens", label: `The domain name contains ${hyphens} hyphens`, points: 8 });
  }

  const digits = (sld.match(/\d/g) || []).length;
  if (sld.length >= 6 && (digits >= 5 || digits / sld.length > 0.4)) {
    findings.push({ code: "many-digits", label: "The domain name is mostly digits or contains a long number", points: 5 });
  }

  if (target.publicSuffix) {
    const tld = target.publicSuffix.split(".").pop();
    if (HIGH_ABUSE_TLDS.has(tld)) {
      findings.push({
        code: "abused-tld",
        label: `The .${tld} ending is cheap to register and frequently abused (many legitimate sites use it too)`,
        points: 8,
      });
    }
  }

  const hostKeywords = SUSPICIOUS_KEYWORDS.filter((word) => host.includes(word));
  const uniqueHostKeywords = dedupeContained(hostKeywords);
  if (uniqueHostKeywords.length >= 2) {
    findings.push({
      code: "host-keywords",
      label: `The hostname stacks trust or urgency words: ${uniqueHostKeywords.slice(0, 5).join(", ")}`,
      points: 12,
    });
  } else if (uniqueHostKeywords.length === 1) {
    findings.push({
      code: "host-keywords",
      label: `The hostname contains the word "${uniqueHostKeywords[0]}"`,
      points: 5,
    });
  }

  if (target.port !== 80 && target.port !== 443) {
    findings.push({ code: "odd-port", label: `The site is served on non-standard port ${target.port}`, points: 8 });
  }

  const extension = (target.pathname || "").toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  if (extension && RISKY_EXTENSIONS.includes(extension)) {
    findings.push({
      code: "risky-download",
      label: `The link points directly at a .${extension} file, which can install software`,
      points: 15,
    });
  }

  if (/[?&][^=]{1,30}=(https?:|https?%3a)/i.test(target.search || "")) {
    findings.push({
      code: "embedded-url",
      label: "Another web address is embedded in the query string, a pattern used for redirect tricks",
      points: 4,
    });
  }

  const encoded = (pathAndQuery.match(/%[0-9a-f]{2}/g) || []).length;
  if (encoded > 15) {
    findings.push({ code: "heavy-encoding", label: `The address contains ${encoded} encoded characters`, points: 4 });
  }

  return findings;
}

function dedupeContained(words) {
  return words.filter((word) => !words.some((other) => other !== word && other.includes(word)));
}

export function checkUrlPatterns(inputTarget, finalTarget) {
  const findings = analyzeUrl(inputTarget);
  const evidence = [
    { label: "Scanned address", value: inputTarget.href },
    { label: "Hostname", value: inputTarget.unicodeHostname },
    { label: "Scheme", value: inputTarget.protocol.replace(":", "").toUpperCase() },
  ];

  if (finalTarget && finalTarget.hostname !== inputTarget.hostname) {
    evidence.push({ label: "Final destination", value: finalTarget.href });
    const seen = new Set(findings.map((finding) => finding.code));
    for (const finding of analyzeUrl(finalTarget)) {
      if (!seen.has(finding.code)) findings.push({ ...finding, label: `Destination: ${finding.label}` });
    }
  }

  return makeCheck({
    id: ID,
    title: TITLE,
    findings,
    summary:
      findings.length === 0
        ? "The address has a normal structure."
        : `${findings.length} unusual pattern${findings.length === 1 ? "" : "s"} found in the address.`,
    explanation:
      "Scam links often give themselves away through structure: raw IP addresses, look-alike characters, stacked words like 'secure-login-verify', or deeply nested subdomains that hide the real domain. These patterns are hints, not proof.",
    evidence,
  });
}
