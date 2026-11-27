import { CHECK_INFO, isOptionalCheck, MAIN_CHECK_IDS } from "@/lib/scanner/check-info";

/**
 * Helpers that turn a stored scan into what the report shows. They read old reports (made before
 * registration data and tiers existed) as well as new ones, and never change a stored scan.
 */

const DAY_MS = 86_400_000;

/** Older reports used "skipped" for a missing API key. To the reader that is simply "unavailable". */
function normalize(check) {
  return check.status === "skipped" ? { ...check, status: "unavailable" } : check;
}

/**
 * Main checks in display order, then the technical ones. An optional integration (such as VirusTotal)
 * joins the main grid and its totals only when it really ran; when it is unavailable it goes to
 * `optional`, which is shown on its own line and never counted as a failure or as safe.
 * Anything else (such as a removed integration) is ignored.
 */
export function splitChecks(checks) {
  const list = (checks || []).map(normalize);
  const byId = new Map(list.map((check) => [check.id, check]));
  const optionalAll = list.filter((check) => isOptionalCheck(check.id));
  return {
    main: [
      ...MAIN_CHECK_IDS.map((id) => byId.get(id)).filter(Boolean),
      ...optionalAll.filter((check) => check.status !== "unavailable"),
    ],
    optional: optionalAll.filter((check) => check.status === "unavailable"),
    technical: list.filter((check) => CHECK_INFO[check.id]?.tier === "technical"),
  };
}

/**
 * Counts shown in the summary. Always computed from the checks on screen, so the numbers can never
 * disagree with the grid. Passed, Warning, Failed and Unavailable are counted separately; an
 * informational result (for example no registry record for a raw IP address) is completed but none of those.
 */
export function tallyChecks(main) {
  const unavailable = main.filter((check) => check.status === "unavailable");
  const count = (status) => main.filter((check) => check.status === status).length;
  return {
    total: main.length,
    completed: main.length - unavailable.length,
    passed: count("pass"),
    warnings: count("warn"),
    failed: count("fail"),
    unavailable,
  };
}

export const checkLabel = (check) => CHECK_INFO[check.id]?.label || check.title;

/* ---------- Domain intelligence ---------- */

const evidenceValue = (check, label) => check?.evidence?.find((item) => item.label === label)?.value ?? null;
const dateOrNull = (value) => (value && !Number.isNaN(Date.parse(value)) ? value : null);

/** Registration facts for the "Domain intelligence" section. */
export function getDomainInfo(scan, main) {
  const check = main.find((item) => item.id === "domain-age");
  if (!check) return null;
  const data = check.data || {};

  // Reports made before structured data existed only carry the facts as evidence rows.
  const registered = dateOrNull(data.registered) || dateOrNull(evidenceValue(check, "Registered"));
  const expires = dateOrNull(data.expires) || dateOrNull(evidenceValue(check, "Expires"));
  const updated = dateOrNull(data.updated) || dateOrNull(evidenceValue(check, "Last updated"));
  const registrarRaw = data.registrar || evidenceValue(check, "Registrar");
  const registrar = registrarRaw && registrarRaw !== "Not disclosed" ? registrarRaw : null;

  let ageDays = Number.isFinite(data.ageDays) ? data.ageDays : null;
  if (ageDays === null && registered) {
    const reference = Date.parse(scan.scannedAt);
    if (!Number.isNaN(reference)) ageDays = Math.max(0, Math.floor((reference - Date.parse(registered)) / DAY_MS));
  }
  const evidenceAge = evidenceValue(check, "Age");
  const reason = data.unavailableReason || (check.status === "unavailable" ? check.summary : null);

  return {
    lookupState: lookupState(check, data, registered, reason),
    check,
    status: check.status,
    registered,
    expires,
    updated,
    registrar,
    ageDays,
    ageText: data.ageText || (evidenceAge && evidenceAge !== "Unknown" ? evidenceAge : null),
    privacyProtected: Boolean(data.privacyProtected),
    statuses: Array.isArray(data.statuses) ? data.statuses : [],
    source: data.source || null,
    notApplicable: check.status === "info",
    hasDate: Boolean(registered),
    reason,
  };
}

/** Phrases older reports used when the lookup itself went wrong (before `data.lookupFailed` existed). */
const LEGACY_FAILURE = /could not be reached|could not be retrieved|limiting requests|did not finish|timed out/i;

/**
 * "ok" (dates shown), "failed" (the lookup went wrong, rescan) or "unavailable" (the registry does not
 * publish the data). A check that hit the scanner's time limit carries no data at all, which is a failure.
 */
function lookupState(check, data, registered, reason) {
  if (check.status === "info") return "not-applicable";
  if (registered) return "ok";
  if (typeof data.lookupFailed === "boolean") return data.lookupFailed ? "failed" : "unavailable";
  if (!check.data || LEGACY_FAILURE.test(reason || "")) return "failed";
  return "unavailable";
}

/** Age bands for the small age scale. Informational only: a band says how old, never how trustworthy. */
export const AGE_BANDS = [
  { id: "new", label: "Under 30 days", max: 30 },
  { id: "young", label: "Under 1 year", max: 365 },
  { id: "established", label: "1 to 5 years", max: 1826 },
  { id: "old", label: "5+ years", max: Infinity },
];

export function ageBandIndex(ageDays) {
  if (ageDays === null || ageDays === undefined) return -1;
  return AGE_BANDS.findIndex((band) => ageDays < band.max);
}

/** Date-only display in UTC, so a registry timestamp never shifts to a different day for the reader. */
const UTC_DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
export function formatUtcDate(value) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : UTC_DATE.format(new Date(time));
}

/* ---------- Positive signals and concerns ---------- */

/** What a clean result means in plain words. Used only when that check really passed. */
const POSITIVE_TEXT = {
  "safe-browsing": () => "Not on Google's list of dangerous websites",
  virustotal: () => "No security vendor on VirusTotal has flagged it",
  impersonation: () => "Does not pretend to be a well-known brand",
  content: () => "No fake login forms or copied brand pages found",
  "url-patterns": () => "The web address uses no common scam tricks",
  ssl: () => "Uses a valid secure connection (HTTPS)",
  redirects: () => "The link goes where it says it goes",
};

/**
 * Most telling first. Domain age is left out because the Domain intelligence card already shows it,
 * and domain setup because a working setup says little on its own.
 */
const POSITIVE_ORDER = ["safe-browsing", "virustotal", "impersonation", "content", "url-patterns", "ssl", "redirects"];

/**
 * The most important findings. Positives come only from checks that actually passed: an unavailable
 * check never produces a reassuring line. Concerns are the real findings of any check, biggest first.
 */
export function buildSignals(main, technical, domainInfo) {
  const positives = POSITIVE_ORDER.map((id) => main.find((check) => check.id === id))
    .filter((check) => check && check.status === "pass")
    .map((check) => ({ id: check.id, text: POSITIVE_TEXT[check.id](check, domainInfo) }))
    .slice(0, 5);

  const concerns = [...main, ...technical]
    .filter((check) => check.status === "warn" || check.status === "fail")
    .flatMap((check) => check.findings.map((finding) => ({ id: finding.code, checkId: check.id, text: finding.label, points: finding.points })))
    .filter((item, index, all) => item.points > 0 && all.findIndex((other) => other.id === item.id) === index)
    .sort((a, b) => b.points - a.points)
    .slice(0, 6);

  return { positives, concerns };
}
