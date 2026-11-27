"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { subscribeToAuth } from "@/lib/services/auth-service";

const AuthContext = createContext(null);

/** Stand-in account used only while Firebase credentials have not been added. */
const PREVIEW_USER = {
  uid: "preview",
  email: null,
  displayName: "Preview User",
  photoURL: null,
  emailVerified: false,
  providers: [],
  createdAt: null,
  lastSignInAt: null,
  isPreview: true,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    return subscribeToAuth((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      /** The signed-in Firebase user, or null. */
      user,
      /** The account the app area should render for: the real user, or the preview user. */
      account: user || (isFirebaseConfigured ? null : PREVIEW_USER),
      loading,
      configured: isFirebaseConfigured,
      preview: !isFirebaseConfigured,
      /** Called after profile edits so the UI reflects them immediately. */
      refreshUser: setUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
