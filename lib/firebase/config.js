/**
 * Central Firebase web configuration.
 *
 * Add your project's values to .env.local (see .env.example). These NEXT_PUBLIC_ values
 * are safe to expose: they identify the project, they do not grant access. Access is
 * controlled by Firebase Authentication and the rules in firestore.rules.
 *
 * Each variable must be referenced literally so Next.js can inline it at build time.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True once the required values are present. Until then the app runs in preview mode. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

export const COLLECTIONS = {
  users: "users",
  scans: "scans",
  reports: "reports",
};
