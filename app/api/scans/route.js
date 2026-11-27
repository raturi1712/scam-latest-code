import { getRequestUser } from "@/lib/server/auth";
import { errorResponse, json, tooManyRequests } from "@/lib/server/http";
import { clientIp, LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { listScans } from "@/lib/server/repositories";


/** List the signed-in user's scan history (summaries only, newest first). */
export async function GET(request) {
  const limited = rateLimit(`read:${clientIp(request)}`, LIMITS.read);
  if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);

  const { user, status } = await getRequestUser(request);
  if (status === "unconfigured") {
    return errorResponse(503, "persistence_unavailable", "Scan history storage is not configured on the server.");
  }
  if (!user) return errorResponse(401, "unauthorized", "Sign in to view your scan history.");

  try {
    return json({ scans: await listScans(user.uid) });
  } catch (error) {
    console.error("[scans] list failed:", error?.message);
    return errorResponse(500, "server_error", "Your scan history could not be loaded.");
  }
}
