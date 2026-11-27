/**
 * Sliding-window rate limiter kept in process memory.
 *
 * This protects a single server instance. On serverless platforms each instance has its
 * own memory, so for strict global limits in production swap the `hits` Map for a shared
 * store (for example Upstash Redis or Vercel KV) behind the same `rateLimit` signature.
 */
const hits = new Map();
const MAX_KEYS = 20_000;
let lastSweep = 0;

function sweep(now) {
  if (now - lastSweep < 60_000 && hits.size < MAX_KEYS) return;
  lastSweep = now;
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key);
  }
  // Hard cap so a flood of unique keys cannot exhaust memory.
  if (hits.size >= MAX_KEYS) hits.clear();
}

/**
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }}
 */
export function rateLimit(key, { limit, windowMs }, now = Date.now()) {
  sweep(now);
  let entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { timestamps: [], resetAt: now + windowMs };
    hits.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter((time) => now - time < windowMs);

  if (entry.timestamps.length >= limit) {
    const retryAfterMs = windowMs - (now - entry.timestamps[0]);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  entry.timestamps.push(now);
  entry.resetAt = now + windowMs;
  return { allowed: true, remaining: limit - entry.timestamps.length, retryAfterSeconds: 0 };
}

/** Apply several limits; the first one exceeded wins. */
export function rateLimitAll(checks) {
  for (const [key, options] of checks) {
    const result = rateLimit(key, options);
    if (!result.allowed) return result;
  }
  return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
}

/** Best-effort client IP. On Vercel the first x-forwarded-for entry is set by the platform. */
export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip");
  return candidate && candidate.length <= 64 ? candidate : "unknown";
}

export const LIMITS = {
  scanBurst: { limit: 6, windowMs: 60_000 },
  scanHourly: { limit: 40, windowMs: 3_600_000 },
  reportBurst: { limit: 3, windowMs: 10 * 60_000 },
  reportDaily: { limit: 10, windowMs: 24 * 3_600_000 },
  read: { limit: 120, windowMs: 60_000 },
};
