"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, CalendarCheck, Layers, OctagonAlert, ScanSearch, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LEVEL_COLORS, LEVEL_ICONS, RiskBadge } from "@/components/scan/RiskBadge";
import { ScanForm } from "@/components/scan/ScanForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { getLevel } from "@/lib/scoring/levels";
import { activityByDay, computeStats } from "@/lib/services/scan-service";
import { useScans } from "@/lib/services/use-scans";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, timeAgo, toDate } from "@/lib/utils/format";
import { ActivityChart, RiskBreakdownChart } from "./Charts";

const KPI_TONES = {
  primary: "bg-primary-soft text-primary-ink",
  success: "bg-success-soft text-success-fg",
  danger: "bg-danger-soft text-danger-fg",
  accent: "bg-accent-soft text-accent",
};

function KpiCard({ label, value, icon: Icon, tone, note, loading }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={cn("inline-flex size-9 items-center justify-center rounded-lg", KPI_TONES[tone])} aria-hidden="true">
          <Icon className="size-[1.125rem]" strokeWidth={1.9} />
        </span>
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className="text-[2rem] font-semibold leading-none tracking-tight tabular-nums text-fg">{value}</p>
        )}
        <p className="mt-2 text-xs text-subtle">{note}</p>
      </div>
    </Card>
  );
}

function ViewAll({ href, children = "View all" }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
      {children}
      <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

function RecentScansTable({ scans }) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Recent scans</caption>
          <thead>
            <tr className="border-b border-line text-xs text-subtle">
              <th scope="col" className="px-5 py-2.5 font-medium">
                Domain
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Risk
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Score
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                Scanned
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {scans.map((scan) => (
              <tr key={scan.id} className="group transition-colors hover:bg-surface-2/40">
                <td className="max-w-[16rem] px-5 py-3">
                  <Link href={`/scans/${scan.id}`} className="block truncate font-medium text-fg group-hover:text-primary-ink">
                    {scan.domain}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={scan.level} />
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums text-fg">{scan.score}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-muted" title={formatDateTime(scan.scannedAt)}>
                  {timeAgo(scan.scannedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line sm:hidden">
        {scans.map((scan) => (
          <li key={scan.id}>
            <Link href={`/scans/${scan.id}`} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{scan.domain}</p>
                <p className="text-xs text-subtle">{timeAgo(scan.scannedAt)}</p>
              </div>
              <RiskBadge level={scan.level} score={scan.score} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function LatestFindings({ scans }) {
  const risky = scans.filter((scan) => scan.level === "high" || scan.level === "suspicious").slice(0, 5);
  if (risky.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-success-soft text-success-fg" aria-hidden="true">
          <ShieldCheck className="size-5" strokeWidth={1.9} />
        </span>
        <p className="text-sm font-medium text-fg">No risky sites detected</p>
        <p className="max-w-xs text-xs text-muted">Suspicious and high-risk results from your scans will be flagged here.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-1 p-2">
      {risky.map((scan) => {
        const Icon = LEVEL_ICONS[scan.level];
        const color = LEVEL_COLORS[scan.level];
        return (
          <li key={scan.id}>
            <Link href={`/scans/${scan.id}`} className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2/60">
              <span
                className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: color.soft, color: color.fg }}
                aria-hidden="true"
              >
                <Icon className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{scan.domain}</p>
                <p className="mt-0.5 text-xs text-muted">
                  <span style={{ color: color.fg }}>{getLevel(scan.level)?.label}</span> · score {scan.score} · {timeAgo(scan.scannedAt)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardView() {
  const router = useRouter();
  const { account } = useAuth();
  const { scans, loading, error, reload } = useScans();
  const [today] = useState(() => new Date().toDateString());
  const stats = computeStats(scans);
  const firstName = account.displayName.split(" ")[0];
  const isEmpty = !loading && !error && scans.length === 0;
  const recent = scans.slice(0, 6);
  const scansToday = scans.filter((scan) => toDate(scan.scannedAt)?.toDateString() === today).length;

  return (
    <div className="space-y-6">
      {/* Title row with quick scan */}
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between" aria-labelledby="welcome-heading">
        <div className="min-w-0">
          <h1 id="welcome-heading" className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">
            {isEmpty ? `Welcome, ${firstName}` : `Welcome back, ${firstName}`}
          </h1>
          <p className="mt-1.5 text-[0.9375rem] text-muted">
            {isEmpty
              ? "Run your first scan to see how a website scores. Paste a link from any message you are unsure about."
              : "Here is what your recent scans found. Got a new link? Check it before you click."}
          </p>
        </div>
        <ScanForm
          className="w-full xl:max-w-md"
          buttonLabel="Scan"
          label="Quick scan a website"
          onScan={(url) => router.push(`/scan?url=${encodeURIComponent(url)}`)}
        />
      </section>

      {error ? (
        <Alert tone="error" title="Your scans could not be loaded">
          {error}{" "}
          <button type="button" onClick={reload} className="font-semibold text-fg underline underline-offset-2">
            Try again
          </button>
        </Alert>
      ) : null}

      {/* KPIs */}
      <section aria-label="Scan totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total scans" value={stats.total} icon={Layers} tone="primary" loading={loading} note="All websites you have checked" />
        <KpiCard label="Low-risk websites" value={stats.safe} icon={ShieldCheck} tone="success" loading={loading} note="No major risk signals" />
        <KpiCard
          label="High-risk websites"
          value={stats.high}
          icon={OctagonAlert}
          tone="danger"
          loading={loading}
          note={stats.suspicious > 0 ? `Plus ${stats.suspicious} suspicious` : "Strong scam indicators"}
        />
        <KpiCard label="Scans today" value={scansToday} icon={CalendarCheck} tone="accent" loading={loading} note="Since midnight, your time" />
      </section>

      {isEmpty ? (
        <EmptyState
          icon={ScanSearch}
          title="No scans yet"
          description="Your activity charts and recent results will appear here after your first scan. Every scan is saved to your history automatically."
          action={<ButtonLink href="/scan">Scan your first website</ButtonLink>}
        />
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <Card as="section" aria-labelledby="activity-heading" className="min-w-0">
              <CardHeader
                title={<span id="activity-heading">Scan activity</span>}
                description="Scans per day over the last 7 days, by risk level"
                action={<Activity className="size-4 text-subtle" strokeWidth={2} aria-hidden="true" />}
              />
              <div className="px-4 py-5 sm:px-6">{loading ? <Skeleton className="h-72 w-full" /> : <ActivityChart data={activityByDay(scans)} />}</div>
            </Card>
            <Card as="section" aria-labelledby="levels-heading" className="flex min-w-0 flex-col">
              <CardHeader title={<span id="levels-heading">Risk distribution</span>} description="All scans by risk level" />
              <div className="flex flex-1 flex-col justify-center px-5 py-6 sm:px-6">{loading ? <Skeleton className="h-44 w-full" /> : <RiskBreakdownChart stats={stats} />}</div>
            </Card>
          </div>

          {/* Recent scans and findings */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <Card as="section" aria-labelledby="recent-heading" className="min-w-0 overflow-hidden">
              <CardHeader title={<span id="recent-heading">Recent scans</span>} action={<ViewAll href="/history" />} />
              {loading ? (
                <div className="space-y-2.5 p-5">
                  {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <RecentScansTable scans={recent} />
              )}
            </Card>
            <Card as="section" aria-labelledby="findings-heading" className="min-w-0">
              <CardHeader
                title={<span id="findings-heading">Latest security findings</span>}
                description="Suspicious and high-risk results"
              />
              {loading ? (
                <div className="space-y-2.5 p-5">
                  {[0, 1, 2].map((item) => (
                    <Skeleton key={item} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <LatestFindings scans={scans} />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
