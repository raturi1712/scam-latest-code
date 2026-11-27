import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";

/**
 * Identify the caller from an `Authorization: Bearer <Firebase ID token>` header.
 *
 * Returns:
 *   { user: { uid, email }, status: "authenticated" }
 *   { user: null, status: "anonymous" }      no token sent
 *   { user: null, status: "invalid" }        token sent but rejected
 *   { user: null, status: "unconfigured" }   token sent but the Admin SDK has no credentials
 *
 * The uid always comes from the verified token, never from the request body or URL.
 */
export async function getRequestUser(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+([A-Za-z0-9._-]{20,4096})$/);
  if (!match) return { user: null, status: header ? "invalid" : "anonymous" };
  if (!isAdminConfigured()) return { user: null, status: "unconfigured" };

  try {
    const decoded = await adminAuth().verifyIdToken(match[1]);
    return { user: { uid: decoded.uid, email: decoded.email || null }, status: "authenticated" };
  } catch {
    return { user: null, status: "invalid" };
  }
}
