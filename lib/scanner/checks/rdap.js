import { domainToASCII } from "node:url";
import { isIP } from "node:net";
import { fetchJson } from "../safe-request.js";
import { makeCheck, unavailable } from "./check.js";

const ID = "domain-age";
const TITLE = "Domain registration and age";

const EXPLANATION =
  "Registration data comes from RDAP, the official registry lookup protocol that replaced WHOIS, queried directly at the registry that manages the domain's extension. Scam sites are usually short-lived, so a very recent registration deserves extra caution. It is only one signal: many legitimate businesses are new, and old domains can be sold or hacked.";

const DAY_MS = 86_400_000;

/* ---------- Finding the right registry (IANA RDAP bootstrap) ---------- */

const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;
const BOOTSTRAP_RETRY_MS = 5 * 60 * 1000;
const BOOTSTRAP_TIMEOUT_MS = 3000;

/**
 * Public RDAP redirector (rdap.org). It applies the same IANA bootstrap and redirects to the
 * authoritative registry. Used only when the IANA list itself could not be loaded, so a temporary
 * IANA outage never makes a supported extension look "unsupported".
 */
const REDIRECTOR = "https://rdap.org/";

/* The whole lookup must finish inside the scanner's 10 s per-check guard (lib/scanner/index.js). */
const LOOKUP_BUDGET_MS = 8500;
const ATTEMPT_TIMEOUT_MS = 4000;
const MIN_ATTEMPT_MS = 1000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [300, 900];
const MAX_RETRY_AFTER_MS = 2000;

/** Used only if the IANA list cannot be fetched. Covers the most common extensions. */
const FALLBACK_SERVERS = {
  com: "https://rdap.verisign.com/com/v1/",
  net: "https://rdap.verisign.com/net/v1/",
  org: "https://rdap.publicinterestregistry.org/rdap/",
  in: "https://rdap.nixiregistry.in/rdap/",
};

const bootstrap = { map: null, loadedAt: 0, failedAt: 0, pending: null };

/** Accept only https registry hosts that are real names, never IPs or local names. */
function safeServer(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (isIP(parsed.hostname) || !parsed.hostname.includes(".")) return null;
    return parsed.href.endsWith("/") ? parsed.href : `${parsed.href}/`;
  } catch {
    return null;
  }
}

/** Turn the IANA bootstrap document into a Map of extension -> RDAP base URL. Pure, for testing. */
export function parseBootstrap(document) {
  const map = new Map();
  for (const service of Array.isArray(document?.services) ? document.services : []) {
    const [extensions, urls] = service;
    const server = (Array.isArray(urls) ? urls : []).map(safeServer).find(Boolean);
    if (!server) continue;
    for (const extension of Array.isArray(extensions) ? extensions : []) map.set(String(extension).toLowerCase(), server);
  }
  return map;
}

/**
 * Returns { map, complete }. `complete` is true when the map is the real IANA list (fresh or a
 * previous good copy), so a missing extension really is unsupported. With only the short fallback
 * list, a missing extension means "unknown", not "unsupported".
 */
async function loadBootstrap() {
  const now = Date.now();
  const fallback = () =>
    bootstrap.map ? { map: bootstrap.map, complete: true } : { map: new Map(Object.entries(FALLBACK_SERVERS)), complete: false };

  if (bootstrap.map && now - bootstrap.loadedAt < BOOTSTRAP_TTL_MS) return { map: bootstrap.map, complete: true };
  if (bootstrap.pending) return bootstrap.pending;
  // Do not hammer IANA while it is unreachable: reuse the last good copy (or the fallback list).
  if (now - bootstrap.failedAt < BOOTSTRAP_RETRY_MS) return fallback();

  bootstrap.pending = (async () => {
    try {
      const { ok, data } = await fetchJson(BOOTSTRAP_URL, { timeoutMs: BOOTSTRAP_TIMEOUT_MS });
      const map = ok ? parseBootstrap(data) : new Map();
      if (map.size === 0) throw new Error("empty bootstrap");
      bootstrap.map = map;
      bootstrap.loadedAt = Date.now();
      return { map, complete: true };
    } catch {
      bootstrap.failedAt = Date.now();
      return fallback();
    } finally {
      bootstrap.pending = null;
    }
  })();
  return bootstrap.pending;
}

/** Longest matching suffix wins: "bbc.co.uk" tries "co.uk" and then "uk". Pure, for testing. */
export function pickRdapServer(map, domain) {
  const labels = String(domain).toLowerCase().split(".");
  for (let start = 1; start < labels.length; start += 1) {
    const server = map.get(labels.slice(start).join("."));
    if (server) return server;
  }
  return null;
}

/* ---------- Reading the response ---------- */

/** Extract the useful fields from an RDAP domain response. Pure, for testing. */
export function parseRdapDomain(data) {
  const events = Array.isArray(data?.events) ? data.events : [];
  // RFC 9083 event actions. If a registry lists an action more than once, the earliest
  // "registration" and the latest "expiration"/"last changed" are the meaningful ones.
  const eventDate = (action, pick = "first") => {
    const dates = events
      .filter((entry) => typeof entry?.eventAction === "string" && entry.eventAction.toLowerCase() === action)
      .map((entry) => (entry?.eventDate ? new Date(entry.eventDate) : null))
      .filter((date) => date && !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return null;
    return pick === "latest" ? dates[dates.length - 1] : dates[0];
  };

  let registrar = null;
  for (const entity of Array.isArray(data?.entities) ? data.entities : []) {
    if (Array.isArray(entity?.roles) && entity.roles.includes("registrar")) {
      const card = Array.isArray(entity?.vcardArray?.[1]) ? entity.vcardArray[1] : [];
      const field = (key) => {
        const value = card.find((item) => Array.isArray(item) && item[0] === key)?.[3];
        const text = Array.isArray(value) ? value.filter(Boolean).join(" ") : value;
        return typeof text === "string" && text.trim() ? text.trim() : null;
      };
      registrar = field("fn") || field("org");
      break;
    }
  }

  // RFC 9537 "redacted" lists fields the registry hides; many registries also write it into remarks.
  const privacyProtected =
    (Array.isArray(data?.redacted) && data.redacted.length > 0) ||
    /redacted|privacy/i.test(JSON.stringify(data?.remarks || []));

  return {
    registered: eventDate("registration"),
    expires: eventDate("expiration", "latest"),
    // "last changed" is the record's own update; "last update of RDAP database" is not about the domain.
    updated: eventDate("last changed", "latest"),
    registrar,
    statuses: Array.isArray(data?.status) ? data.status.map(String) : [],
    privacyProtected,
  };
}

/**
 * Exact calendar difference between two dates ("4 years, 3 months, 2 days"), not a days/365 estimate.
 * A start date in the future (clock skew) counts as zero.
 */
export function calendarAge(from, to = new Date()) {
  if (from.getTime() >= to.getTime()) return { years: 0, months: 0, days: 0, totalDays: 0 };
  // Whole months first (the day of month is clamped to the month's end, so 31 Jan + 1 month = 28 Feb),
  // then the days left over. This never produces a negative or "30-day-month" artefact.
  let wholeMonths = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  let anchor = addMonths(from, wholeMonths);
  if (anchor.getTime() > to.getTime()) {
    wholeMonths -= 1;
    anchor = addMonths(from, wholeMonths);
  }
  return {
    years: Math.floor(wholeMonths / 12),
    months: wholeMonths % 12,
    days: Math.floor((to.getTime() - anchor.getTime()) / DAY_MS),
    totalDays: Math.floor((to.getTime() - from.getTime()) / DAY_MS),
  };
}

function addMonths(date, count) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + count;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()),
  );
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "4 years and 3 months", "5 months and 2 days", "12 days", "less than a day". */
export function describeAge(age) {
  if (age.years > 0) return age.months > 0 ? `${plural(age.years, "year")} and ${plural(age.months, "month")}` : plural(age.years, "year");
  if (age.months > 0) return age.days > 0 ? `${plural(age.months, "month")} and ${plural(age.days, "day")}` : plural(age.months, "month");
  if (age.days > 0) return plural(age.days, "day");
  return "less than a day";
}

/** Turn registration facts into findings. Pure, for testing. */
export function gradeRegistration(info, now = Date.now()) {
  const findings = [];
  const ageDays = info.registered ? (now - info.registered.getTime()) / DAY_MS : null;

  // A young domain is a reason for caution, never proof of fraud: these points alone stay below "Suspicious".
  if (ageDays !== null) {
    const rounded = Math.max(0, Math.floor(ageDays));
    if (ageDays < 7) {
      findings.push({ code: "domain-new", label: `The domain was registered only ${rounded} day${rounded === 1 ? "" : "s"} ago`, points: 18 });
    } else if (ageDays < 30) {
      findings.push({ code: "domain-new", label: `The domain was registered ${rounded} days ago (under a month)`, points: 14 });
    } else if (ageDays < 90) {
      findings.push({ code: "domain-young", label: `The domain was registered ${rounded} days ago (under 3 months)`, points: 10 });
    } else if (ageDays < 180) {
      findings.push({ code: "domain-young", label: `The domain is under 6 months old (${rounded} days)`, points: 6 });
    } else if (ageDays < 365) {
      findings.push({ code: "domain-young", label: `The domain is under a year old (${rounded} days)`, points: 2 });
    }
  }

  if (info.expires) {
    const daysLeft = (info.expires.getTime() - now) / DAY_MS;
    if (daysLeft < 0) {
      findings.push({ code: "domain-expired", label: "The domain registration has expired", points: 15 });
    } else if (daysLeft < 30 && ageDays !== null && ageDays < 400) {
      findings.push({
        code: "domain-expiring",
        label: `The registration ends in ${Math.floor(daysLeft)} days and was only bought for a short term`,
        points: 5,
      });
    }
  }

  const held = info.statuses.find((status) => /hold/i.test(status));
  if (held) {
    findings.push({
      code: "domain-hold",
      label: `The registry lists the domain as "${held}", meaning it has been suspended`,
      points: 20,
    });
  }

  return { findings, ageDays };
}

/* ---------- Querying the registry ---------- */

const sleepFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A Retry-After header (seconds or an HTTP date) as milliseconds, or null. Pure, for testing. */
export function parseRetryAfter(value, now = Date.now()) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  const date = Date.parse(text);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

const isRetryableStatus = (status) => status === 408 || status === 429 || status >= 500;

/**
 * GET one RDAP URL with a per-attempt timeout and a few retries, all inside `deadline`.
 * Retries network errors, timeouts, 408, 429 (honouring a short Retry-After) and 5xx. Other 4xx
 * answers are never retried: a 404 is the registry's real answer.
 *
 * Returns { ok, status, data, attempts, finalUrl, reason }, reason being one of
 * ok | not-found | rate-limited | timeout | network | http | bad-response.
 */
export async function fetchRdap(
  url,
  { fetcher = fetchJson, sleep = sleepFor, deadline = Date.now() + LOOKUP_BUDGET_MS, maxAttempts = MAX_ATTEMPTS } = {},
) {
  let last = { ok: false, status: 0, data: null, reason: "timeout" };
  let attempts = 0;

  while (attempts < maxAttempts) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    attempts += 1;
    let waitMs = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];

    try {
      const response = await fetcher(url, {
        headers: { Accept: "application/rdap+json, application/json" },
        timeoutMs: Math.min(ATTEMPT_TIMEOUT_MS, remaining),
      });
      const { status, data } = response;
      const finalUrl = response.url || url;

      if (response.ok) {
        const isObject = data && typeof data === "object" && !Array.isArray(data);
        // Some registries answer 200 with an RDAP error object instead of a proper status code.
        if (isObject && Number(data.errorCode) === 404 && !data.ldhName) {
          return { ok: false, status: 404, data: null, attempts, finalUrl, reason: "not-found" };
        }
        if (isObject) return { ok: true, status, data, attempts, finalUrl, reason: "ok" };
        return { ok: false, status, data: null, attempts, finalUrl, reason: "bad-response" };
      }
      if (status === 404) return { ok: false, status, data: null, attempts, finalUrl, reason: "not-found" };

      last = { ok: false, status, data: null, finalUrl, reason: status === 429 ? "rate-limited" : "http" };
      if (!isRetryableStatus(status)) break;
      if (status === 429) {
        const retryAfter = parseRetryAfter(response.headers?.get?.("retry-after"));
        // The registry asked us to wait longer than a scan can: report the rate limit instead.
        if (retryAfter !== null && retryAfter > MAX_RETRY_AFTER_MS) break;
        if (retryAfter !== null) waitMs = Math.max(waitMs, retryAfter);
      }
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError" || error?.code === "timeout";
      last = { ok: false, status: 0, data: null, reason: timedOut ? "timeout" : "network" };
    }

    if (attempts >= maxAttempts || Date.now() + waitMs + MIN_ATTEMPT_MS > deadline) break;
    await sleep(waitMs);
  }
  return { ...last, attempts };
}

/**
 * Ask the authoritative registry (found through the IANA RDAP bootstrap) about a domain.
 * Returns fetchRdap's result plus `server` (the host that answered) and `via` (registry | redirector),
 * or { ok: false, reason: "unsupported" } when the extension has no RDAP service at all.
 */
export async function queryRegistry(domain, { fetcher = fetchJson, sleep, loadServers = loadBootstrap, budgetMs = LOOKUP_BUDGET_MS } = {}) {
  const deadline = Date.now() + budgetMs;
  const ascii = (domainToASCII(domain) || domain).toLowerCase();
  const { map, complete } = await loadServers();

  let base = pickRdapServer(map, ascii);
  let via = "registry";
  if (!base) {
    if (complete) return { ok: false, status: 0, data: null, attempts: 0, reason: "unsupported" };
    base = REDIRECTOR;
    via = "redirector";
  }

  const result = await fetchRdap(`${base}domain/${encodeURIComponent(ascii)}`, { fetcher, sleep, deadline });
  let server = new URL(base).hostname;
  try {
    if (result.finalUrl) server = new URL(result.finalUrl).hostname;
  } catch {
    // keep the base host
  }
  return { ...result, server, via };
}

/* ---------- The check ---------- */

const iso = (date) => (date ? date.toISOString() : null);
const day = (date) => (date ? date.toISOString().slice(0, 10) : "Not disclosed");
const READABLE_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const readable = (date) => READABLE_DATE.format(date);
const tries = (count) => (count > 1 ? ` after ${count} attempts` : "");

/**
 * Why there is no registration date, split into two kinds the report shows differently:
 *   failed: true   the lookup itself went wrong (timeout, network, rate limit, registry error): rescan later
 *   failed: false  the lookup worked, but the data is not public (no RDAP service, no record, no date)
 * Pure, for testing.
 */
export function describeLookupProblem(result, target) {
  const reason = result.reason || (result.status === 404 ? "not-found" : result.status === 429 ? "rate-limited" : "network");
  const suffix = target.publicSuffix || String(target.registrableDomain || "").split(".").slice(1).join(".");
  switch (reason) {
    case "unsupported":
      return {
        lookup: "unsupported",
        failed: false,
        message: `The registry for .${suffix} does not offer a public RDAP lookup service, so its registration data cannot be checked automatically.`,
      };
    case "not-found":
      return {
        lookup: "not-found",
        failed: false,
        message:
          result.via === "redirector"
            ? "No public RDAP record was found for this domain. Its registry may not offer RDAP lookups."
            : "The registry has no public record for this exact domain name.",
      };
    case "rate-limited":
      return { lookup: "rate-limited", failed: true, message: `The registry is limiting requests right now${tries(result.attempts)}. Rescan in a minute or two.` };
    case "timeout":
      return { lookup: "timeout", failed: true, message: `The registry did not answer in time${tries(result.attempts)}. Rescan in a moment.` };
    case "http":
      return { lookup: "error", failed: true, message: `The registry returned an error (HTTP ${result.status})${tries(result.attempts)}. Rescan in a moment.` };
    case "bad-response":
      return { lookup: "error", failed: true, message: "The registry sent a response that could not be read. Rescan in a moment." };
    default:
      return { lookup: "network", failed: true, message: `The registry could not be reached${tries(result.attempts)}. Rescan in a moment.` };
  }
}

export async function checkDomainRegistration(target, { query = queryRegistry, now = Date.now() } = {}) {
  if (target.isIpHost) {
    return makeCheck({
      id: ID,
      title: TITLE,
      core: true,
      status: "info",
      summary: "Not applicable: a raw IP address has no domain registration.",
      explanation: EXPLANATION,
      data: { lookup: "not-applicable" },
    });
  }

  const domain = target.registrableDomain;
  let result;
  try {
    result = await query(domain);
  } catch {
    result = { ok: false, reason: "network" };
  }

  if (!result.ok || !result.data) {
    const problem = describeLookupProblem(result, target);
    return unavailable({
      id: ID,
      title: TITLE,
      core: true,
      summary: `${problem.failed ? "Registration lookup failed." : "Registration date unavailable."} ${problem.message}`,
      explanation: EXPLANATION,
      evidence: [
        { label: "Domain", value: domain },
        { label: "Lookup result", value: problem.failed ? "Failed" : "No public data" },
        { label: "Data source", value: result.server },
      ],
      data: {
        lookup: problem.lookup,
        lookupFailed: problem.failed,
        unavailableReason: problem.message,
        source: result.server || null,
        attempts: result.attempts ?? null,
      },
    });
  }

  const info = parseRdapDomain(result.data);
  const base = {
    registered: iso(info.registered),
    expires: iso(info.expires),
    updated: iso(info.updated),
    registrar: info.registrar,
    statuses: info.statuses.slice(0, 8),
    privacyProtected: info.privacyProtected,
    source: result.server || null,
    attempts: result.attempts ?? null,
  };

  if (!info.registered) {
    const reason = "The registry answered, but its record for this domain does not include a registration date.";
    return unavailable({
      id: ID,
      title: TITLE,
      core: true,
      summary: `Registration date unavailable. ${reason}`,
      explanation: EXPLANATION,
      evidence: [
        { label: "Domain", value: domain },
        { label: "Expires", value: day(info.expires) },
        { label: "Last updated", value: info.updated ? day(info.updated) : null },
        { label: "Registrar", value: info.registrar || "Not disclosed" },
        { label: "Data source", value: result.server },
      ],
      data: { ...base, lookup: "no-date", lookupFailed: false, unavailableReason: reason },
    });
  }

  const { findings, ageDays } = gradeRegistration(info, now);
  const age = calendarAge(info.registered, new Date(now));
  const ageText = describeAge(age);
  const hardFinding = findings.some((finding) => finding.code === "domain-hold" || finding.code === "domain-expired");

  return makeCheck({
    id: ID,
    title: TITLE,
    core: true,
    findings,
    // Age findings are caution signs, not failures; only a suspended or expired domain is serious.
    status: findings.length > 0 && !hardFinding ? "warn" : undefined,
    summary:
      ageDays < 1
        ? `Registered ${readable(info.registered)}, less than a day ago.`
        : `Registered ${readable(info.registered)}, ${ageText} ago.`,
    explanation: EXPLANATION,
    evidence: [
      { label: "Domain", value: domain },
      { label: "Registered", value: day(info.registered) },
      { label: "Age", value: ageText },
      { label: "Expires", value: day(info.expires) },
      { label: "Last updated", value: info.updated ? day(info.updated) : null },
      { label: "Registrar", value: info.registrar || "Not disclosed" },
      { label: "Registry status", value: info.statuses.slice(0, 6).join(", ") },
      { label: "Data source", value: result.server },
    ],
    data: {
      ...base,
      lookup: "ok",
      lookupFailed: false,
      ageDays: Math.max(0, Math.floor(ageDays)),
      ageYears: age.years,
      ageMonths: age.months,
      ageText,
    },
  });
}
