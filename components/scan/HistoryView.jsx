"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, History, Plus, RefreshCw, Search, SearchX, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { CONTROL, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeading } from "@/components/ui/PageHeading";
import { useToast } from "@/components/ui/Toast";
import { RISK_LEVELS } from "@/lib/scoring/levels";
import { computeStats } from "@/lib/services/scan-service";
import { useScans } from "@/lib/services/use-scans";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, toDate } from "@/lib/utils/format";
import { LEVEL_COLORS, RiskBadge } from "./RiskBadge";

const SORTS = {
  newest: { label: "Newest first", compare: (a, b) => String(b.scannedAt).localeCompare(String(a.scannedAt)) },
  oldest: { label: "Oldest first", compare: (a, b) => String(a.scannedAt).localeCompare(String(b.scannedAt)) },
  riskiest: { label: "Highest risk first", compare: (a, b) => b.score - a.score },
  safest: { label: "Lowest risk first", compare: (a, b) => a.score - b.score },
};

const DAY = 86400000;
const RANGES = {
  all: { label: "All time", ms: null },
  today: { label: "Today", ms: "today" },
  week: { label: "Last 7 days", ms: 7 * DAY },
  month: { label: "Last 30 days", ms: 30 * DAY },
  quarter: { label: "Last 90 days", ms: 90 * DAY },
};

const PAGE_SIZE = 10;

function inRange(scan, range, now) {
  const spec = RANGES[range];
  if (!spec || spec.ms === null) return true;
  const date = toDate(scan.scannedAt);
  if (!date) return false;
  if (spec.ms === "today") return date.toDateString() === new Date(now).toDateString();
  return now - date.getTime() <= spec.ms;
}

function ScoreBar({ scan }) {
  const color = LEVEL_COLORS[scan.level] || LEVEL_COLORS.safe;
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 text-right text-sm font-semibold tabular-nums text-fg">{scan.score}</span>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(3, scan.score)}%`, background: color.solid }} />
      </span>
    </div>
  );
}

const ICON_BASE =
  "inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const ICON_BUTTON = `${ICON_BASE} hover:bg-surface-2 hover:text-fg`;
const ICON_BUTTON_DANGER = `${ICON_BASE} hover:bg-danger-soft hover:text-danger-fg`;

function RowActions({ scan, onRescan, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/scans/${scan.id}`}
        className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium text-fg transition-colors hover:border-line-strong hover:bg-surface-2"
        aria-label={`View report for ${scan.domain}`}
      >
        <FileText className="size-3.5" strokeWidth={2} aria-hidden="true" />
        View report
      </Link>
      <button type="button" className={ICON_BUTTON} aria-label={`Rescan ${scan.domain}`} title="Rescan" onClick={onRescan}>
        <RefreshCw className="size-4" strokeWidth={1.9} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={ICON_BUTTON_DANGER}
        aria-label={`Delete scan of ${scan.domain}`}
        title="Delete"
        onClick={onDelete}
      >
        <Trash2 className="size-4" strokeWidth={1.9} aria-hidden="true" />
      </button>
    </div>
  );
}

export function HistoryView() {
  const router = useRouter();
  const toast = useToast();
  const { scans, loading, error, reload, remove } = useScans();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [now] = useState(() => Date.now());

  const stats = computeStats(scans);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scans
      .filter((scan) => level === "all" || scan.level === level)
      .filter((scan) => inRange(scan, range, now))
      .filter((scan) => !needle || `${scan.domain} ${scan.url} ${scan.finalUrl || ""}`.toLowerCase().includes(needle))
      .sort(SORTS[sort].compare);
  }, [scans, query, level, range, sort, now]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstRow = visible.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(currentPage * PAGE_SIZE, visible.length);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await remove(pendingDelete.id);
      toast.success(`Deleted the scan of ${pendingDelete.domain}.`);
      setPendingDelete(null);
    } catch (failure) {
      toast.error(failure.message || "The scan could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  const rescan = (scan) => router.push(`/scan?url=${encodeURIComponent(scan.url)}`);
  const tabs = [{ id: "all", label: "All", count: stats.total }, ...RISK_LEVELS.map((item) => ({ id: item.id, label: item.label, count: stats[item.id] }))];
  const filtered = query.trim() !== "" || level !== "all" || range !== "all";
  const update = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <PageHeading
        title="Scan history"
        description="Every website you have scanned. Open a report, run a fresh scan or remove records you no longer need."
        actions={
          <ButtonLink href="/scan" size="sm">
            <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
            New scan
          </ButtonLink>
        }
      />

      {error ? (
        <Alert tone="error" title="Your history could not be loaded" className="mb-6">
          {error}{" "}
          <button type="button" onClick={reload} className="font-semibold text-fg underline underline-offset-2">
            Try again
          </button>
        </Alert>
      ) : null}

      {loading ? (
        <Card className="space-y-3 p-5" aria-busy="true">
          <Skeleton className="h-11 w-full" />
          {[0, 1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </Card>
      ) : scans.length === 0 && !error ? (
        <EmptyState
          icon={History}
          title="No scans yet"
          description="Scans you run while signed in are saved here automatically, so you can come back to any report."
          action={<ButtonLink href="/scan">Scan a website</ButtonLink>}
        />
      ) : scans.length > 0 ? (
        <Card className="overflow-hidden">
          {/* Toolbar */}
          <div className="space-y-4 border-b border-line px-4 py-4 sm:px-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_12rem]">
              <div className="relative">
                <label htmlFor="history-search" className="sr-only">
                  Search scans by domain or URL
                </label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={2} aria-hidden="true" />
                <input
                  id="history-search"
                  type="search"
                  value={query}
                  onChange={(event) => update(setQuery)(event.target.value)}
                  placeholder="Search by domain or URL"
                  className={cn(CONTROL, "h-10 pl-9 text-sm")}
                />
              </div>
              <div>
                <label htmlFor="history-range" className="sr-only">
                  Filter by scan date
                </label>
                <Select id="history-range" value={range} onChange={(event) => update(setRange)(event.target.value)} size="sm">
                  {Object.entries(RANGES).map(([value, option]) => (
                    <option key={value} value={value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="history-sort" className="sr-only">
                  Sort scans
                </label>
                <Select id="history-sort" value={sort} onChange={(event) => update(setSort)(event.target.value)} size="sm">
                  {Object.entries(SORTS).map(([value, option]) => (
                    <option key={value} value={value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by risk level">
              {tabs.map((tab) => {
                const active = level === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update(setLevel)(tab.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      active ? "bg-primary text-white" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {tab.id !== "all" ? (
                      <span className="size-2 rounded-full" style={{ background: LEVEL_COLORS[tab.id].solid }} aria-hidden="true" />
                    ) : null}
                    {tab.label}
                    <span
                      className={cn(
                        "rounded-md px-1.5 text-xs tabular-nums",
                        active ? "bg-white/20 text-white" : "bg-surface-2 text-muted",
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              bare
              icon={SearchX}
              title="No matching scans"
              description="No scans match your search and filters. Try a different term or clear the filters."
              action={
                filtered ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setLevel("all");
                      setRange("all");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              {/* Desktop and tablet: table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Scan history</caption>
                  <thead>
                    <tr className="border-b border-line bg-surface-2/40 text-xs font-medium text-subtle">
                      <th scope="col" className="px-5 py-3 font-medium">
                        Domain
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Scan date
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Risk score
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {pageRows.map((scan) => (
                      <tr key={scan.id} className="transition-colors hover:bg-surface-2/40">
                        <td className="max-w-[18rem] px-5 py-3.5">
                          <Link href={`/scans/${scan.id}`} className="block truncate font-medium text-fg hover:text-primary-ink">
                            {scan.domain}
                          </Link>
                          <p className="truncate font-mono text-xs text-subtle">{scan.url}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-muted">
                          <time dateTime={scan.scannedAt}>{formatDateTime(scan.scannedAt)}</time>
                        </td>
                        <td className="px-4 py-3.5">
                          <ScoreBar scan={scan} />
                        </td>
                        <td className="px-4 py-3.5">
                          <RiskBadge level={scan.level} />
                        </td>
                        <td className="px-5 py-3.5">
                          <RowActions scan={scan} onRescan={() => rescan(scan)} onDelete={() => setPendingDelete(scan)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked rows */}
              <ul className="divide-y divide-line md:hidden">
                {pageRows.map((scan) => (
                  <li key={scan.id} className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/scans/${scan.id}`} className="block truncate font-medium text-fg">
                          {scan.domain}
                        </Link>
                        <p className="mt-0.5 text-xs text-subtle">
                          <time dateTime={scan.scannedAt}>{formatDateTime(scan.scannedAt)}</time>
                        </p>
                      </div>
                      <RiskBadge level={scan.level} score={scan.score} />
                    </div>
                    <RowActions scan={scan} onRescan={() => rescan(scan)} onDelete={() => setPendingDelete(scan)} />
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
                <p className="text-sm text-muted" role="status">
                  Showing <span className="font-medium text-fg">{firstRow}</span>–<span className="font-medium text-fg">{lastRow}</span> of{" "}
                  <span className="font-medium text-fg">{visible.length}</span> scan{visible.length === 1 ? "" : "s"}
                </p>
                {pageCount > 1 ? (
                  <nav className="flex items-center gap-1" aria-label="Pagination">
                    <button
                      type="button"
                      className={cn(ICON_BUTTON, "border border-line disabled:opacity-40")}
                      onClick={() => setPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
                    </button>
                    <span className="px-2 text-sm tabular-nums text-muted">
                      Page {currentPage} of {pageCount}
                    </span>
                    <button
                      type="button"
                      className={cn(ICON_BUTTON, "border border-line disabled:opacity-40")}
                      onClick={() => setPage(currentPage + 1)}
                      disabled={currentPage === pageCount}
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </nav>
                ) : null}
              </div>
            </>
          )}
        </Card>
      ) : null}

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => (deleting ? null : setPendingDelete(null))}
        title="Delete this scan?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              Delete scan
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <p>
            The scan of <strong className="break-all font-semibold text-fg">{pendingDelete.domain}</strong> from{" "}
            {formatDateTime(pendingDelete.scannedAt)} will be permanently removed from your history. This cannot be undone.
          </p>
        ) : null}
      </Modal>
    </>
  );
}
