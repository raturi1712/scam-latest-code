"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileX, ScanSearch } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { PageHeading } from "@/components/ui/PageHeading";
import { useToast } from "@/components/ui/Toast";
import { getScan, runScan } from "@/lib/services/scan-service";
import { ScanProgress } from "./ScanProgress";
import { ScanReport } from "./ScanReport";

/** Loads one saved scan (owner only) and renders the detailed report. */
export function SavedReport() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const { account } = useAuth();
  const [state, setState] = useState({ status: "loading", scan: null, error: null });
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getScan(id, { uid: account.uid })
      .then((scan) => !cancelled && setState({ status: "ready", scan, error: null }))
      .catch((error) => {
        if (cancelled) return;
        setState({ status: error.status === 404 ? "missing" : "error", scan: null, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [id, account.uid]);

  async function rescan() {
    setRescanning(true);
    try {
      const fresh = await runScan(state.scan.url, { uid: account.uid, keep: true });
      toast.success("Rescan complete. Showing the new report.");
      if (fresh.id) router.push(`/scans/${fresh.id}`);
      else setState({ status: "ready", scan: fresh, error: null });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRescanning(false);
    }
  }

  const back = (
    <ButtonLink href="/history" variant="secondary" size="sm">
      <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
      Scan history
    </ButtonLink>
  );

  const another = (
    <ButtonLink href="/scan" size="sm">
      <ScanSearch className="size-4" strokeWidth={2} aria-hidden="true" />
      Scan another website
    </ButtonLink>
  );

  if (state.status === "loading") return <PageLoader label="Loading report" />;

  if (state.status === "missing") {
    return (
      <EmptyState
        icon={FileX}
        title="Report not found"
        description="This report does not exist, was deleted, or belongs to a different account."
        action={back}
      />
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="The report could not be loaded">
          {state.error}
        </Alert>
        {back}
      </div>
    );
  }

  return (
    <>
      <PageHeading
        title="Security report"
        description="A full breakdown of every check, the evidence collected and what to do next."
        actions={
          <>
            {back}
            {another}
          </>
        }
      />
      {rescanning ? (
        <div className="mb-6">
          <ScanProgress url={state.scan.url} />
        </div>
      ) : null}
      <ScanReport scan={state.scan} onRescan={rescan} rescanning={rescanning} />
    </>
  );
}
