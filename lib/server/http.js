import { NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data, status = 200, headers = {}) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorResponse(status, code, message, extra = {}) {
  return NextResponse.json({ error: { code, message, ...extra.body } }, { status, headers: { ...NO_STORE, ...extra.headers } });
}

export function tooManyRequests(retryAfterSeconds) {
  const wait = retryAfterSeconds >= 120 ? `${Math.ceil(retryAfterSeconds / 60)} minutes` : `${retryAfterSeconds} seconds`;
  return errorResponse(429, "rate_limited", `Too many requests. Please try again in ${wait}.`, {
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

/**
 * Parse a small JSON body. Rejects wrong content types and oversized payloads
 * before any work is done. Returns { data } or { response } (an error to return).
 */
export async function readJsonBody(request, maxBytes = 8 * 1024) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { response: errorResponse(415, "unsupported_media_type", "Send the request as application/json.") };
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    return { response: errorResponse(413, "payload_too_large", "The request is too large.") };
  }
  let text;
  try {
    text = await request.text();
  } catch {
    return { response: errorResponse(400, "bad_request", "The request body could not be read.") };
  }
  if (text.length > maxBytes) {
    return { response: errorResponse(413, "payload_too_large", "The request is too large.") };
  }
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
    return { data };
  } catch {
    return { response: errorResponse(400, "bad_request", "The request body is not valid JSON.") };
  }
}

/**
 * Basic CSRF defence for state-changing routes: when a browser sends an Origin header,
 * it must match the host the request was sent to.
 */
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client; these routes rely on bearer tokens, not cookies
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
