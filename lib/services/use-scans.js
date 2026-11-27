"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { deleteScan, listScans } from "./scan-service";

/** Loads the current account's scan history and exposes reload/remove helpers. */
export function useScans() {
  const { account, user } = useAuth();
  const uid = account?.uid || null;
  const remote = Boolean(user);
  const [state, setState] = useState({ scans: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!uid) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const scans = await listScans({ uid, remote });
      setState({ scans, loading: false, error: null });
    } catch (error) {
      setState({ scans: [], loading: false, error: error.message });
    }
  }, [uid, remote]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount / account change
    load();
  }, [load]);

  const remove = useCallback(
    async (id) => {
      await deleteScan(id, { uid });
      setState((current) => ({ ...current, scans: current.scans.filter((scan) => scan.id !== id) }));
    },
    [uid],
  );

  return { ...state, reload: load, remove };
}
