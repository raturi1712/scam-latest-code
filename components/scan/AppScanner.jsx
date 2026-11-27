"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowRightLeft, CalendarClock, History, Lock, Network, ShieldCheck, UserRoundX } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert, Skeleton } from "@/components/ui/Feedback";
import { runScan } from "@/lib/services/scan-service";
import { useScans } from "@/lib/services/use-scans";
import { timeAgo } from "@/lib/utils/format";
import { RiskBadge } from "./RiskBadge";
import { ScanForm } from "./ScanForm";
import { ScanProgress } from "./ScanProgress";
import { ScanReport } from "./ScanReport";

const COVERAGE = [
  { icon: CalendarClock, label: "Domain age" },
  { icon: Lock, label: "SSL certificate" },
  { icon: Network, label: "DNS records" },
  { icon: ArrowRightLeft, label: "Redirects" },
  { icon: UserRoundX, label: "Impersonation" },
];

const TIPS = [
  { title: "Paste the exact link", text: "Scam pages often hide in the path, so scan the full address from the message." },
  { title: "Check the real domain", text: "The report shows the registrable domain. That is who you are really dealing with." },
  { title: "Look at the age", text: "A shop or bank on a domain registered last week deserves real suspicion." },
  { title: "Ignore the padlock", text: "HTTPS only means the connection is encrypted. Scam sites have it too." },
];

function RecentScans() {
  const { scans, loading, error } = useScans();
  const recent = scans.slice(0, 5);

  return (
    <Card as="section" aria-labelledby="recent-scans-heading" className="min-w-0">
      <CardHeader
        title={<span id="recent-scans-heading">Recent scans</span>}
        action={
          <Link href="/history" className="inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
            View all
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        }
      />
      {loading ? (
        <div className="space-y-2.5 p-5">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-muted">Recent scans could not be loaded.</p>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <History className="size-6 text-subtle" strokeWidth={1.9} aria-hidden="true" />
          <p className="text-sm font-medium text-fg">No scans yet</p>
          <p className="max-w-xs text-sm text-muted">Your scans are saved here automatically so you can reopen any report.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {recent.map((scan) => (
            <li key={scan.id}>
              <Link href={`/scans/${scan.id}`} className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{scan.domain}</p>
                  <p className="truncate text-xs text-subtle">{timeAgo(scan.scannedAt)}</p>
                </div>
                <RiskBadge level={scan.level} score={scan.score} />
                <ArrowRight
                  className="hidden size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg sm:block"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** In-app scanner: runs the scan, saves it to history and opens the saved report. */
export function AppScanner() {
  const router = useRouter();
  const params = useSearchParams();
  const queryUrl = params.get("url") || "";
  const { account } = useAuth();
  const [state, setState] = useState({ status: queryUrl ? "scanning" : "idle", url: queryUrl, scan: null, error: null });
  const started = useRef("");

  const scan = useCallback(
    async (url) => {
      setState({ status: "scanning", url, scan: null, error: null });
      try {
        const result = await runScan(url, { uid: account.uid, keep: true });
        if (result.id) {
          router.replace(`/scans/${result.id}`);
          return;
        }
        // Could not be stored anywhere (for example storage blocked): still show the result.
        setState({ status: "done", url, scan: result, error: null });
      } catch (error) {
        setState({ status: "error", url, scan: null, error: error.message });
      }
    },
    [account.uid, router],
  );

  useEffect(() => {
    if (!queryUrl || started.current === queryUrl) return;
    started.current = queryUrl;
    scan(queryUrl);
  }, [queryUrl, scan]);

  const busy = state.status === "scanning";

  return (
    <div className="space-y-6">
      <Card shadow="lg" className="no-print relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(60% 120% at 0% 0%, rgb(59 130 246 / 0.14), transparent 60%)" }}
          aria-hidden="true"
        />
        <div className="relative px-5 py-6 sm:px-8 sm:py-8">
          <ScanForm
            key={queryUrl}
            size="lg"
            defaultValue={queryUrl}
            loading={busy}
            showLabel
            label="Website to scan"
            onScan={(url) => {
              started.current = url;
              scan(url);
            }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {COVERAGE.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                <item.icon className="size-3.5 text-accent" strokeWidth={2} aria-hidden="true" />
                {item.label}
              </span>
            ))}
            <span className="text-xs text-subtle">and 7 more checks</span>
          </div>
          <p className="mt-4 flex items-start gap-2 border-t border-line pt-4 text-xs text-subtle">
            <ShieldCheck className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            Only public websites can be scanned. Internal addresses, private IPs and non-web ports are blocked, and nothing
            from the scanned page is ever run.
          </p>
        </div>
      </Card>

      {busy ? <ScanProgress url={state.url} /> : null}

      {state.status === "error" ? (
        <Alert tone="error" title="The scan could not be completed">
          {state.error}
        </Alert>
      ) : null}

      {state.status === "done" ? <ScanReport scan={state.scan} onRescan={() => scan(state.scan.url)} /> : null}

      {state.status === "idle" || state.status === "error" ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <RecentScans />
          <Card as="section" aria-labelledby="tips-heading">
            <CardHeader title={<span id="tips-heading">Reading your results</span>} />
            <ul className="space-y-4 px-5 py-5">
              {TIPS.map((tip, index) => (
                <li key={tip.title} className="flex gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[0.6875rem] font-semibold text-primary-ink">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fg">{tip.title}</p>
                    <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{tip.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
