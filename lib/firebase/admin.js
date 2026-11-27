/**
 * Firebase Admin SDK (server only). Used by route handlers to verify ID tokens and to
 * read/write Firestore with server-side ownership checks.
 *
 * Never import this file from a client component. The credentials come from
 * non-public environment variables (no NEXT_PUBLIC_ prefix), so they are never bundled
 * for the browser.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function readCredentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Environment variables store the key with literal "\n" sequences; restore real newlines.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

export function isAdminConfigured() {
  return readCredentials() !== null;
}

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;
  const credentials = readCredentials();
  if (!credentials) throw new Error("Firebase Admin credentials are not configured.");
  return initializeApp({ credential: cert(credentials), projectId: credentials.projectId });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
