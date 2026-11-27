import { getIdToken } from "./auth-service";

/**
 * Client-side access to scans.
 *
 * With Firebase configured and a signed-in user, scans are stored in Firestore by the
 * server (see app/api/scan). In preview mode, or if server storage is unavailable, scan
 * history falls back to this browser's localStorage so the product stays usable.
 */

export class ApiError extends Error {
  constructor(message, { code = "error", status = 0, fields = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await getIdToken().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Network error. Check your connection and try again.", { code: "network" });
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(data?.error?.message || "Something went wrong. Please try again.", {
      code: data?.error?.code || "error",
      status: response.status,
      fields: data?.error?.fields || null,
    });
  }
  return data;
}

/* ---------- Local (browser) storage fallback ---------- */

const LOCAL_PREFIX = "local-";
const LOCAL_LIMIT = 50;
const storageKey = (uid) => `scamshield.scans.v1.${uid || "preview"}`;

function readLocal(uid) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(uid)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(uid, scans) {
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(scans.slice(0, LOCAL_LIMIT)));
  } catch {
    // Storage full or blocked: history simply will not persist.
  }
}

function summarize(scan) {
  return {
    id: scan.id,
    url: scan.url,
    finalUrl: scan.finalUrl,
    domain: scan.domain,
    hostname: scan.hostname,
    score: scan.score,
    level: scan.level,
    levelLabel: scan.levelLabel,
    scannedAt: scan.scannedAt,
  };
}

export const isLocalId = (id) => typeof id === "string" && id.startsWith(LOCAL_PREFIX);

/* ---------- Public API ---------- */

/**
 * Run a scan.
 * @param {string} url
 * @param {{ uid?: string|null, keep?: boolean }} options  keep=true stores the result in history.
 */
export async function runScan(url, { uid = null, keep = false } = {}) {
  const data = await apiFetch("/api/scan", { method: "POST", body: { url } });
  const scan = data.scan;

  if (keep && !data.saved) {
    const random = Math.random().toString(36).slice(2, 10);
    scan.id = `${LOCAL_PREFIX}${Date.now().toString(36)}${random}`;
    writeLocal(uid, [scan, ...readLocal(uid)]);
  }
  return scan;
}

/** Newest-first list of scan summaries for the current user. */
export async function listScans({ uid = null, remote = false } = {}) {
  const local = readLocal(uid).map(summarize);
  if (!remote) return local;
  try {
    const data = await apiFetch("/api/scans");
    // Include any scans that fell back to local storage while the server store was down.
    return [...data.scans, ...local].sort((a, b) => String(b.scannedAt).localeCompare(String(a.scannedAt)));
  } catch (error) {
    if (error.code === "persistence_unavailable") return local;
    throw error;
  }
}

export async function getScan(id, { uid = null } = {}) {
  if (isLocalId(id)) {
    const scan = readLocal(uid).find((entry) => entry.id === id);
    if (!scan) throw new ApiError("Scan not found.", { code: "not_found", status: 404 });
    return scan;
  }
  const data = await apiFetch(`/api/scans/${encodeURIComponent(id)}`);
  return data.scan;
}

export async function deleteScan(id, { uid = null } = {}) {
  if (isLocalId(id)) {
    writeLocal(uid, readLocal(uid).filter((entry) => entry.id !== id));
    return;
  }
  await apiFetch(`/api/scans/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function submitReport(report) {
  return apiFetch("/api/reports", { method: "POST", body: report });
}

/** Aggregate numbers for the dashboard. Pure. */
export function computeStats(scans) {
  const counts = { safe: 0, low: 0, suspicious: 0, high: 0 };
  for (const scan of scans) {
    if (counts[scan.level] !== undefined) counts[scan.level] += 1;
  }
  return { total: scans.length, ...counts };
}

/** Scans per day for the last `days` days, split by level. Pure. */
export function activityByDay(scans, days = 7, now = new Date()) {
  const buckets = [];
  const formatter = new Intl.DateTimeFormat("en", { weekday: "short" });
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    buckets.push({ key: date.toDateString(), day: formatter.format(date), safe: 0, low: 0, suspicious: 0, high: 0 });
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const scan of scans) {
    const date = new Date(scan.scannedAt);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = byKey.get(date.toDateString());
    if (bucket && bucket[scan.level] !== undefined) bucket[scan.level] += 1;
  }
  return buckets;
}
