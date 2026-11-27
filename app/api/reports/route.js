import { isAdminConfigured } from "@/lib/firebase/admin";
import { normalizeUrl, ScanInputError } from "@/lib/scanner/url";
import { getRequestUser } from "@/lib/server/auth";
import { errorResponse, isSameOrigin, json, readJsonBody, tooManyRequests } from "@/lib/server/http";
import { clientIp, LIMITS, rateLimitAll } from "@/lib/server/rate-limit";
import { saveReport } from "@/lib/server/repositories";
import { cleanText, validateReport } from "@/lib/utils/validation";


/** Minimum time a human needs to fill in the form. Faster submissions are treated as bots. */
const MIN_FILL_MS = 3000;

/** Public endpoint: anyone can report a suspicious website. */
export async function POST(request) {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "forbidden", "Cross-site requests are not allowed.");
  }

  const ip = clientIp(request);
  const limited = rateLimitAll([
    [`report:burst:${ip}`, LIMITS.reportBurst],
    [`report:day:${ip}`, LIMITS.reportDaily],
  ]);
  if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);

  const body = await readJsonBody(request, 16 * 1024);
  if (body.response) return body.response;
  const input = body.data;

  // Abuse protection: a hidden honeypot field and a minimum fill time.
  // Bots get a success-shaped response so they learn nothing.
  const elapsed = Number(input.elapsedMs);
  if ((typeof input.website === "string" && input.website.trim() !== "") || (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)) {
    return json({ received: true });
  }

  const errors = validateReport(input);
  let target = null;
  if (!errors.url) {
    try {
      target = normalizeUrl(input.url);
    } catch (error) {
      errors.url = error instanceof ScanInputError ? error.message.replace("scanned", "reported") : "Enter a valid website address.";
    }
  }
  if (Object.keys(errors).length > 0) {
    return errorResponse(422, "validation_failed", "Please correct the highlighted fields.", { body: { fields: errors } });
  }

  if (!isAdminConfigured()) {
    return errorResponse(
      503,
      "persistence_unavailable",
      "Reports cannot be saved yet because the database is not configured. Please try again later.",
    );
  }

  const { user } = await getRequestUser(request);
  try {
    await saveReport(
      {
        url: target.href,
        domain: target.registrableDomain || target.hostname,
        category: input.category,
        reason: input.reason,
        description: cleanText(input.description, 2000),
        contactEmail: input.contactEmail ? cleanText(input.contactEmail, 254).toLowerCase() : null,
      },
      { uid: user?.uid || null, ip },
    );
  } catch (error) {
    console.error("[reports] save failed:", error?.message);
    return errorResponse(500, "server_error", "Your report could not be saved. Please try again.");
  }

  return json({ received: true }, 201);
}
