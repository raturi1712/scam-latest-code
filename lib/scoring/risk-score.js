import { checkTier, isOptionalCheck } from "../scanner/check-info.js";
import { levelForScore } from "./levels.js";

/**
 * ScamShield risk score: transparent, additive, rule-based. No machine learning.
 *
 * How it works
 * 1. Every check produces findings. Each finding carries fixed points (see lib/scanner/checks).
 * 2. A finding code is counted once per scan, even if two checks report it, so the same
 *    problem can never be scored twice.
 * 3. A check's points are the sum of its findings, capped at PER_CHECK_CAP so that one noisy
 *    check cannot decide the result alone. The blocklist check uses a higher cap because a
 *    confirmed listing is strong evidence by itself.
 * 4. A check that could not run adds NO points and is never treated as a pass. Missing
 *    information is not evidence of risk and not evidence of safety: it is reported as
 *    unavailable and the assessment is marked incomplete (see `coverage`).
 * 5. Nothing subtracts points. In particular, a valid HTTPS certificate is worth exactly 0:
 *    encryption says nothing about who runs the site.
 * 6. The total is clamped to 0-100 and mapped to a level (see levels.js):
 *    0-14 Low Risk, 15-34 Some Caution, 35-64 Suspicious, 65-100 High Risk.
 */
export const PER_CHECK_CAP = 45;
export const REPUTATION_CAP = 80;

const REPUTATION_CHECKS = new Set(["safe-browsing", "virustotal"]);

/**
 * Count results over the checks the report shows in its main grid: the main checks, plus an optional
 * check only when it really ran. An unavailable optional check is neither a pass nor a failure,
 * so it is left out of the totals.
 */
export function summarizeCoverage(checks) {
  const main = checks.filter(
    (check) =>
      check.status !== "skipped" &&
      (checkTier(check.id) === "main" || (isOptionalCheck(check.id) && check.status !== "unavailable")),
  );
  const count = (status) => main.filter((check) => check.status === status).length;
  const unavailable = main.filter((check) => check.status === "unavailable");
  return {
    total: main.length,
    completed: main.length - unavailable.length,
    passed: count("pass"),
    warnings: count("warn") + count("fail"),
    unavailable: unavailable.map((check) => check.id),
  };
}

export function scoreChecks(checks) {
  const breakdown = [];
  const counted = new Set();
  let total = 0;

  for (const check of checks) {
    const cap = REPUTATION_CHECKS.has(check.id) ? REPUTATION_CAP : PER_CHECK_CAP;
    const fresh = check.findings.filter((finding) => {
      if (counted.has(finding.code)) return false;
      counted.add(finding.code);
      return true;
    });
    const raw = fresh.reduce((sum, finding) => sum + finding.points, 0);
    const points = Math.min(cap, raw);

    if (points > 0) {
      breakdown.push({
        checkId: check.id,
        title: check.title,
        points,
        capped: raw > cap,
        reasons: fresh.filter((finding) => finding.points > 0).map((finding) => ({ ...finding })),
      });
      total += points;
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(total)));
  const level = levelForScore(score);
  breakdown.sort((a, b) => b.points - a.points);

  return {
    score,
    rawTotal: total,
    level: level.id,
    levelLabel: level.label,
    breakdown,
    coverage: summarizeCoverage(checks),
  };
}
