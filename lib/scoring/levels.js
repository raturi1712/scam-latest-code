/**
 * Risk levels and their score thresholds.
 * Shared by the scoring engine (server) and the UI (client).
 */
export const RISK_LEVELS = [
  {
    id: "safe",
    label: "Low Risk",
    min: 0,
    max: 14,
    blurb: "No major risk signals were detected in the checks completed.",
  },
  {
    id: "low",
    label: "Some Caution",
    min: 15,
    max: 34,
    blurb: "A few minor warning signs. Double-check before entering any details.",
  },
  {
    id: "suspicious",
    label: "Suspicious",
    min: 35,
    max: 64,
    blurb: "Several warning signs. Do not enter passwords or payment details.",
  },
  {
    id: "high",
    label: "High Risk",
    min: 65,
    max: 100,
    blurb: "Strong indicators of a scam or unsafe website. Avoid this site.",
  },
];

export const LEVEL_IDS = RISK_LEVELS.map((level) => level.id);

export function levelForScore(score) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return RISK_LEVELS.find((level) => clamped >= level.min && clamped <= level.max) || RISK_LEVELS[0];
}

export function getLevel(id) {
  return RISK_LEVELS.find((level) => level.id === id) || null;
}

/** CSS variables from styles/tokens.css for each level. */
export const LEVEL_STYLE = {
  safe: { bg: "var(--ss-risk-safe)", text: "var(--ss-ink)" },
  low: { bg: "var(--ss-risk-low)", text: "var(--ss-ink)" },
  suspicious: { bg: "var(--ss-risk-suspicious)", text: "var(--ss-ink)" },
  high: { bg: "var(--ss-risk-high)", text: "var(--ss-risk-high-text)" },
};
