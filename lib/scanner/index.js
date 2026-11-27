import { adviceForCode, buildRecommendations } from "../scoring/recommendations.js";
import { scoreChecks } from "../scoring/risk-score.js";
import { CHECK_INFO } from "./check-info.js";
import { statusFromFindings, unavailable } from "./checks/check.js";
import { checkContent } from "./checks/content.js";
import { checkDns } from "./checks/dns.js";
import { checkHttpResponse, checkRedirects, checkShortener } from "./checks/http.js";
import { checkIp } from "./checks/ip-info.js";
import { checkDomainRegistration } from "./checks/rdap.js";
import { checkSafeBrowsing, checkVirusTotal } from "./checks/reputation.js";
import { checkSsl } from "./checks/ssl.js";
import { checkImpersonation } from "./checks/typosquat.js";
import { checkUrlPatterns } from "./checks/url-patterns.js";
import { URL_SHORTENERS } from "./data/lists.js";
import { followRedirects, resolvePublicAddresses, withTimeout } from "./safe-request.js";
import { normalizeUrl, ScanInputError } from "./url.js";

export { ScanInputError } from "./url.js";

export const SCAN_VERSION = 2;
const CHECK_TIMEOUT_MS = 10_000;

/** Run a check with a hard deadline; a crash or timeout becomes "unavailable", never a pass. */
async function guarded(meta, run) {
  try {
    return await withTimeout(Promise.resolve().then(run), CHECK_TIMEOUT_MS, "Check timed out");
  } catch {
    return unavailable({
      ...meta,
      summary: "This check did not finish in time.",
      explanation: "The check timed out or failed unexpectedly. Its result is unknown, not safe.",
    });
  }
}

/**
 * Scan one website. Throws ScanInputError if the URL is invalid or not allowed
 * (private address, unsupported scheme, blocked port). Network failures never throw;
 * they are reported as unavailable checks.
 */
export async function scanWebsite(rawUrl) {
  const startedAt = Date.now();
  let input = normalizeUrl(rawUrl);

  // 1. Follow the redirect chain. Every hop is validated against the SSRF rules first.
  let chain = await followRedirects(input);
  if (chain.blocked && chain.hops.length === 0) {
    throw new ScanInputError(chain.blocked.reason, "blocked_address");
  }

  // The user typed a bare domain and HTTPS did not answer: see whether plain HTTP does.
  if (!input.hadScheme && chain.hops.length === 0 && chain.error && chain.error.code !== "dns_failure") {
    const httpInput = { ...normalizeUrl(`http://${input.href.slice("https://".length)}`), hadScheme: false };
    const retry = await followRedirects(httpInput);
    if (retry.hops.length > 0) {
      input = httpInput;
      chain = retry;
    }
  }

  // 2. Domain-based checks run against where the link really ends up.
  const destination = chain.final?.target || input;
  let addresses = chain.final?.addresses || null;
  if (!addresses) {
    try {
      addresses = await resolvePublicAddresses(destination);
    } catch {
      addresses = [];
    }
  }

  // 3. Independent checks run in parallel.
  const [registration, ssl, dns, ip, safeBrowsing, virusTotal] = await Promise.all([
    guarded({ id: "domain-age", title: "Domain registration and age", core: true }, () => checkDomainRegistration(destination)),
    guarded({ id: "ssl", title: "SSL certificate", core: true }, () => checkSsl(destination, addresses)),
    guarded({ id: "dns", title: "DNS records", core: true }, () => checkDns(destination)),
    guarded({ id: "ip", title: "IP address information" }, () => checkIp(addresses)),
    guarded({ id: "safe-browsing", title: "Google Safe Browsing" }, () =>
      checkSafeBrowsing([input.href, destination.href]),
    ),
    guarded({ id: "virustotal", title: "VirusTotal" }, () => checkVirusTotal(input.href)),
  ]);

  // Impersonation is judged on both the entered and the final domain; keep the worse result.
  let impersonation = checkImpersonation(destination);
  const inputDomain = input.registrableDomain;
  if (inputDomain && inputDomain !== destination.registrableDomain && !URL_SHORTENERS.has(inputDomain)) {
    const forInput = checkImpersonation(input);
    const points = (check) => check.findings.reduce((sum, finding) => sum + finding.points, 0);
    if (points(forInput) > points(impersonation)) impersonation = forInput;
  }

  // A link shortener is part of the redirect story, so its finding is reported under "Redirect chain".
  const redirects = mergeShortener(checkRedirects(chain, input), checkShortener(input, chain));

  const checks = [
    registration,
    ssl,
    safeBrowsing,
    dns,
    checkUrlPatterns(input, destination),
    impersonation,
    redirects,
    checkContent(chain),
    // Optional add-on: counted only when it ran.
    virusTotal,
    // Technical context, shown under "Advanced technical details".
    checkHttpResponse(chain),
    ip,
  ].map(decorate);

  const scoring = scoreChecks(checks);
  const recommendations = buildRecommendations(scoring.level, scoring.breakdown, checks);

  return {
    version: SCAN_VERSION,
    inputUrl: String(rawUrl).trim().slice(0, 2048),
    url: input.href,
    finalUrl: destination.href,
    hostname: destination.unicodeHostname,
    domain: destination.registrableDomain || destination.hostname,
    score: scoring.score,
    level: scoring.level,
    levelLabel: scoring.levelLabel,
    summary: summarize(scoring, destination),
    breakdown: scoring.breakdown,
    coverage: scoring.coverage,
    checks,
    recommendations,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}

/** Fold the link-shortener result into the redirect check so there is one place to read about where a link leads. */
function mergeShortener(redirects, shortener) {
  if (shortener.findings.length === 0) return redirects;
  const findings = [...redirects.findings, ...shortener.findings];
  return {
    ...redirects,
    findings,
    status: redirects.status === "unavailable" ? "unavailable" : statusFromFindings(findings),
    summary: redirects.status === "unavailable" ? redirects.summary : `${shortener.summary} ${redirects.summary}`,
    evidence: [...shortener.evidence, ...redirects.evidence],
  };
}

/** Attach the plain-English fields every check carries: what it looked at, why it matters, what to do next. */
function decorate(check) {
  const info = CHECK_INFO[check.id];
  let action = null;
  if (check.status === "unavailable" && info?.tier === "optional") {
    action = null;
  } else if (check.status === "unavailable") {
    action = "Treat this as unknown, not as safe. Run the scan again later.";
  } else {
    for (const finding of [...check.findings].sort((a, b) => b.points - a.points)) {
      action = adviceForCode(finding.code);
      if (action) break;
    }
    if (!action && (check.status === "warn" || check.status === "fail")) {
      action = "Verify this independently, for example by typing the official address yourself, before you trust the site.";
    }
  }
  return {
    ...check,
    tier: info?.tier || "main",
    what: info?.what || null,
    matters: info?.matters || null,
    action,
  };
}

function summarize(scoring, destination) {
  const name = destination.registrableDomain || destination.hostname;
  const top = scoring.breakdown.flatMap((item) => item.reasons).sort((a, b) => b.points - a.points)[0];
  const { unavailable, total } = scoring.coverage;
  const incomplete =
    unavailable.length > 0
      ? ` ${unavailable.length} of ${total} checks could not be completed, so this assessment is incomplete. Missing information is not counted as a sign of safety.`
      : "";

  if (scoring.level === "safe") {
    return `No major risk signals were detected for ${name} in the checks completed.${incomplete} This is not a guarantee: stay alert for unusual requests.`;
  }
  const lead = {
    low: `${name} shows a few minor warning signs.`,
    suspicious: `${name} shows several warning signs.`,
    high: `${name} shows strong signs of being unsafe.`,
  }[scoring.level];
  return `${lead}${top ? ` Biggest factor: ${lowerFirst(top.label)}.` : ""}${incomplete}`;
}

function lowerFirst(text) {
  // Only soften sentence-style labels; leave quoted names and proper nouns alone.
  return /^(The|A|An|Unusually|Possible|Another|Destination) /.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}
