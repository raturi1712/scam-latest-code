import { createRemoteJWKSet, jwtVerify } from "jose";
import { isAdminConfigured } from "@/lib/firebase/admin";

/**
 * Firebase ID tokens are verified here with `jose`, following Firebase's documented rules,
 * instead of `firebase-admin/auth`. That module pulls in `jwks-rsa`, which `require()`s the
 * ESM-only `jose` and fails to load on the Vercel runtime, taking every API route down with it.
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function firebaseProjectId() {
  return process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}

async function verifyFirebaseIdToken(token) {
  const projectId = firebaseProjectId();
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    clockTolerance: 5,
  });
  if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) {
    throw new Error("Token has no valid subject");
  }
  if (typeof payload.auth_time !== "number" || payload.auth_time > Date.now() / 1000 + 5) {
    throw new Error("Token has an invalid auth_time");
  }
  return payload;
}

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
    const decoded = await verifyFirebaseIdToken(match[1]);
    return { user: { uid: decoded.sub, email: decoded.email || null }, status: "authenticated" };
  } catch {
    return { user: null, status: "invalid" };
  }
}
