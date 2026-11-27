const DATE_TIME = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
const DATE_ONLY = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? DATE_TIME.format(date) : "Unknown";
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? DATE_ONLY.format(date) : "Unknown";
}

export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "3 minutes ago", "2 days ago". */
export function timeAgo(value, now = Date.now()) {
  const date = toDate(value);
  if (!date) return "Unknown";
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, size] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) return `${count} ${name}${count === 1 ? "" : "s"} ago`;
  }
  return "Just now";
}

/** Human-readable age from a number of days: "3 years, 2 months". */
export function formatAge(days) {
  if (days == null || Number.isNaN(days)) return "Unknown";
  if (days < 1) return "Less than a day";
  if (days < 60) return `${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months`;
  const years = Math.floor(days / 365.25);
  const restMonths = Math.floor((days - years * 365.25) / 30.44);
  return restMonths > 0 ? `${years} years, ${restMonths} months` : `${years} years`;
}

export function truncateMiddle(text, max = 48) {
  if (!text || text.length <= max) return text || "";
  const keep = Math.floor((max - 1) / 2);
  return `${text.slice(0, keep)}…${text.slice(-keep)}`;
}
