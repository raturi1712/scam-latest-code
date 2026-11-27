import { isAdminConfigured } from "@/lib/firebase/admin";
import { scanWebsite, ScanInputError } from "@/lib/scanner";
import { getRequestUser } from "@/lib/server/auth";
import { errorResponse, isSameOrigin, json, readJsonBody, tooManyRequests } from "@/lib/server/http";
import { clientIp, LIMITS, rateLimitAll } from "@/lib/server/rate-limit";
import { saveScan } from "@/lib/server/repositories";

// Runs on the default Node.js runtime: the scanner needs Node APIs (dns, tls, net).
export const maxDuration = 45;

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "forbidden", "Cross-site requests are not allowed.");
  }

  const ip = clientIp(request);
  const { user, status } = await getRequestUser(request);
  if (status === "invalid") {
    return errorResponse(401, "unauthorized", "Your session has expired. Please sign in again.");
  }

  const limited = rateLimitAll([
    [`scan:burst:${ip}`, LIMITS.scanBurst],
    [`scan:hour:${ip}`, LIMITS.scanHourly],
    ...(user ? [[`scan:burst:uid:${user.uid}`, LIMITS.scanBurst]] : []),
  ]);
  if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);

  const body = await readJsonBody(request, 4 * 1024);
  if (body.response) return body.response;
  if (typeof body.data.url !== "string") {
    return errorResponse(400, "invalid_url", "Enter a website address to scan.");
  }

  let scan;
  try {
    scan = await scanWebsite(body.data.url);
  } catch (error) {
    if (error instanceof ScanInputError) {
      return errorResponse(400, error.code, error.message);
    }
    console.error("[scan] unexpected failure:", error?.message);
    return errorResponse(500, "scan_failed", "The scan could not be completed. Please try again.");
  }

  // Persist every scan. Signed-in scans go to the user's history; anonymous scans are stored with
  // no owner, so nobody can open them from the app. A storage failure must not lose the result.
  let id = null;
  if (isAdminConfigured()) {
    try {
      const savedId = await saveScan(user?.uid || null, scan, { ip });
      // Only an owner can reopen a saved report, so an anonymous visitor gets no ID back.
      if (user) id = savedId;
    } catch (error) {
      console.error("[scan] could not save scan:", error?.message);
    }
  }

  return json({ scan: { ...scan, id }, saved: Boolean(id) });
}
