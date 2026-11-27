import { getRequestUser } from "@/lib/server/auth";
import { errorResponse, isSameOrigin, json, tooManyRequests } from "@/lib/server/http";
import { clientIp, LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { deleteScan, getScan, isValidDocId } from "@/lib/server/repositories";


async function authorize(request, params) {
  const limited = rateLimit(`read:${clientIp(request)}`, LIMITS.read);
  if (!limited.allowed) return { response: tooManyRequests(limited.retryAfterSeconds) };

  const { user, status } = await getRequestUser(request);
  if (status === "unconfigured") {
    return { response: errorResponse(503, "persistence_unavailable", "Scan storage is not configured on the server.") };
  }
  if (!user) return { response: errorResponse(401, "unauthorized", "Sign in to continue.") };

  const { id } = await params;
  if (!isValidDocId(id)) return { response: errorResponse(404, "not_found", "Scan not found.") };
  return { user, id };
}

/** Fetch one report. Only the owner can read it; anything else is a 404. */
export async function GET(request, { params }) {
  const auth = await authorize(request, params);
  if (auth.response) return auth.response;
  try {
    const scan = await getScan(auth.user.uid, auth.id);
    if (!scan) return errorResponse(404, "not_found", "Scan not found.");
    return json({ scan });
  } catch (error) {
    console.error("[scans] get failed:", error?.message);
    return errorResponse(500, "server_error", "The report could not be loaded.");
  }
}

/** Delete one scan record. Only the owner can delete it. */
export async function DELETE(request, { params }) {
  if (!isSameOrigin(request)) return errorResponse(403, "forbidden", "Cross-site requests are not allowed.");
  const auth = await authorize(request, params);
  if (auth.response) return auth.response;
  try {
    const deleted = await deleteScan(auth.user.uid, auth.id);
    if (!deleted) return errorResponse(404, "not_found", "Scan not found.");
    return json({ deleted: true });
  } catch (error) {
    console.error("[scans] delete failed:", error?.message);
    return errorResponse(500, "server_error", "The scan could not be deleted.");
  }
}
