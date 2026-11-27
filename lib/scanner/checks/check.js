/**
 * Every security check returns the same shape so the UI and the scoring engine
 * can treat them uniformly.
 *
 * status:
 *   pass         the check ran and found nothing concerning
 *   info         the check ran; results are informational only
 *   warn         the check found minor warning signs
 *   fail         the check found serious warning signs
 *   unavailable  the check could not be completed (NOT the same as safe)
 *   skipped      kept only so older saved reports still render; new scans report
 *                an unconfigured integration as "unavailable"
 *
 * Optional `data` carries structured facts for the UI (for example registration dates).
 */
export const CHECK_STATUS = ["pass", "info", "warn", "fail", "unavailable", "skipped"];

export function makeCheck({ id, title, status, summary, explanation, evidence = [], findings = [], core = false, data = null }) {
  const cleanFindings = findings.filter(Boolean).map((finding) => ({
    code: finding.code,
    label: finding.label,
    points: Math.max(0, Math.round(finding.points || 0)),
  }));
  return {
    id,
    title,
    core,
    status: status || statusFromFindings(cleanFindings),
    summary,
    explanation,
    evidence: evidence
      .filter((item) => item && item.value !== undefined && item.value !== null && item.value !== "")
      .map((item) => ({ label: item.label, value: String(item.value).slice(0, 600) })),
    findings: cleanFindings,
    ...(data ? { data } : {}),
  };
}

export function statusFromFindings(findings) {
  const total = findings.reduce((sum, finding) => sum + finding.points, 0);
  const worst = findings.reduce((max, finding) => Math.max(max, finding.points), 0);
  if (worst >= 20 || total >= 30) return "fail";
  if (total > 0) return "warn";
  return "pass";
}

export function unavailable({ id, title, summary, explanation, evidence = [], core = false, data = null }) {
  return makeCheck({ id, title, status: "unavailable", summary, explanation, evidence, core, data });
}

export function skipped({ id, title, summary, explanation }) {
  return makeCheck({ id, title, status: "skipped", summary, explanation });
}
