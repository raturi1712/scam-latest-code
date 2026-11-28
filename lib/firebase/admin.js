/**
 * Firebase Admin SDK (server only). Used by route handlers to
 * read/write Firestore with server-side ownership checks.
 *
 * Never import this file from a client component. The credentials come from
 * non-public environment variables (no NEXT_PUBLIC_ prefix), so they are never bundled
 * for the browser.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Hosting dashboards store the key however it was pasted: with or without the surrounding
 * quotes from .env.local, and with literal "\n" sequences or real line breaks. Accept all of them.
 */
function normalizePrivateKey(raw) {
  if (!raw) return null;
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function readCredentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
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

export function adminDb() {
  return getFirestore(getAdminApp());
}
