import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { COLLECTIONS, isFirebaseConfigured } from "@/lib/firebase/config";

/** Reduce a Firebase user to the plain fields the UI needs. */
export function toAppUser(firebaseUser) {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    providers: firebaseUser.providerData.map((provider) => provider.providerId),
    createdAt: firebaseUser.metadata?.creationTime || null,
    lastSignInAt: firebaseUser.metadata?.lastSignInTime || null,
  };
}

export function subscribeToAuth(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => callback(toAppUser(firebaseUser)));
}

/** Create or refresh the user's profile document. Rules only allow writing your own. */
async function upsertUserDocument(firebaseUser, { isNew = false } = {}) {
  try {
    const ref = doc(getDb(), COLLECTIONS.users, firebaseUser.uid);
    const data = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || "",
      photoURL: firebaseUser.photoURL || null,
      updatedAt: serverTimestamp(),
    };
    if (isNew || !(await getDoc(ref)).exists()) data.createdAt = serverTimestamp();
    await setDoc(ref, data, { merge: true });
  } catch (error) {
    // The account itself was created; a profile-document failure should not block sign-in.
    console.warn("Could not write user profile document:", error?.code || error?.message);
  }
}

export async function signUpWithEmail({ name, email, password }) {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: name.trim() });
  await upsertUserDocument(credential.user, { isNew: true });
  sendEmailVerification(credential.user).catch(() => {});
  return toAppUser(credential.user);
}

export async function signInWithEmail({ email, password }) {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return toAppUser(credential.user);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(getFirebaseAuth(), provider);
  await upsertUserDocument(credential.user);
  return toAppUser(credential.user);
}

export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function signOut() {
  if (!isFirebaseConfigured) return;
  await firebaseSignOut(getFirebaseAuth());
}

export async function updateDisplayName(name) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw Object.assign(new Error("Not signed in"), { code: "auth/no-current-user" });
  await updateProfile(user, { displayName: name.trim() });
  await upsertUserDocument(user);
  return toAppUser(user);
}

export async function changePassword({ currentPassword, newPassword }) {
  const user = getFirebaseAuth().currentUser;
  if (!user?.email) throw Object.assign(new Error("Not signed in"), { code: "auth/no-current-user" });
  // Firebase requires a recent login for sensitive changes.
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}

/** ID token for calling our own API routes. Null when signed out or in preview mode. */
export async function getIdToken() {
  if (!isFirebaseConfigured) return null;
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}

const AUTH_ERRORS = {
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/wrong-password": "The email or password is incorrect.",
  "auth/user-not-found": "The email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact support for help.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
  "auth/weak-password": "Choose a stronger password with at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, then try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
  "auth/cancelled-popup-request": "The Google sign-in window was closed before finishing.",
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  "auth/account-exists-with-different-credential":
    "An account already exists with this email using a different sign-in method.",
  "auth/operation-not-allowed": "This sign-in method is not enabled in the Firebase console yet.",
  "auth/unauthorized-domain": "This domain is not authorized for sign-in. Add it in the Firebase console.",
  "auth/requires-recent-login": "For security, sign out and sign in again before making this change.",
  "auth/no-current-user": "You are not signed in.",
};

export function authErrorMessage(error) {
  return AUTH_ERRORS[error?.code] || "Something went wrong. Please try again.";
}
