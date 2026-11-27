"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, History, ScanSearch } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { IconSquare } from "@/components/ui/IconSquare";
import { runScan } from "@/lib/services/scan-service";
import { ScanForm } from "./ScanForm";
import { ScanProgress } from "./ScanProgress";
import { ScanReport } from "./ScanReport";

/**
 * Public scanner used on /check. Reads ?url=, runs the scan and shows the report inline.
 * Nothing is stored for anonymous visitors; signed-in users are sent to the app scanner.
 */
export function PublicScanner() {
  const router = useRouter();
  const params = useSearchParams();
  const queryUrl = params.get("url") || "";
  const { account, loading: authLoading } = useAuth();

  const [state, setState] = useState({ status: "idle", url: "", scan: null, error: null });
  const started = useRef("");

  const scan = useCallback(async (url) => {
    setState({ status: "scanning", url, scan: null, error: null });
    try {
      const result = await runScan(url);
      setState({ status: "done", url, scan: result, error: null });
    } catch (error) {
      setState({ status: "error", url, scan: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    if (authLoading || !queryUrl) return;
    if (account) {
      // Signed-in (or preview) users get history and saved reports in the app.
      router.replace(`/scan?url=${encodeURIComponent(queryUrl)}`);
      return;
    }
    if (started.current === queryUrl) return;
    started.current = queryUrl;
    scan(queryUrl);
  }, [authLoading, account, queryUrl, router, scan]);

  function submit(url) {
    started.current = url;
    router.replace(`/check?url=${encodeURIComponent(url)}`, { scroll: false });
    scan(url);
  }

  const busy = state.status === "scanning";

  return (
    <div className="space-y-6">
      <div className="no-print">
        <ScanForm key={queryUrl} size="lg" defaultValue={queryUrl} onScan={submit} loading={busy} label="Website to scan" />
      </div>

      {state.status === "idle" && !queryUrl ? (
        <EmptyState
          icon={ScanSearch}
          title="Enter a website to scan"
          description="Paste any link or domain above. You will get a risk score from 0 to 100 with the evidence behind every check."
        />
      ) : null}

      {busy || (state.status === "idle" && queryUrl) ? <ScanProgress url={state.url || queryUrl} /> : null}

      {state.status === "error" ? (
        <Alert tone="error" title="The scan could not be completed">
          {state.error}
        </Alert>
      ) : null}

      {state.status === "done" ? (
        <>
          <ScanReport
            scan={state.scan}
            onRescan={() => scan(state.scan.url)}
            shareUrl={typeof window !== "undefined" ? `${window.location.origin}/check?url=${encodeURIComponent(state.scan.url)}` : undefined}
          />
          <Card tone="subtle" className="no-print flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <IconSquare icon={History} />
              <div>
                <h2 className="text-base font-semibold text-fg">Keep a history of your scans</h2>
                <p className="mt-1 text-sm text-muted">
                  Create a free account to save reports, track sites over time and rescan with one click.{" "}
                  <Link href="/login" className="font-medium text-primary-ink hover:underline">
                    Already have one? Sign in
                  </Link>
                </p>
              </div>
            </div>
            <ButtonLink href="/register" className="shrink-0">
              Create free account
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </ButtonLink>
          </Card>
        </>
      ) : null}
    </div>
  );
}
