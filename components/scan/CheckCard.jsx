"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Bug,
  CalendarClock,
  Check,
  ChevronDown,
  CircleX,
  CircleHelp,
  CircleSlash,
  FileSearch,
  Globe,
  Info,
  Lightbulb,
  Link2,
  Lock,
  Network,
  Radar,
  ScanSearch,
  Server,
  TriangleAlert,
  UserRoundX,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

export const CHECK_ICONS = {
  "url-patterns": ScanSearch,
  impersonation: UserRoundX,
  shortener: Link2,
  "domain-age": CalendarClock,
  ssl: Lock,
  dns: Network,
  ip: Server,
  http: Globe,
  redirects: ArrowRightLeft,
  content: FileSearch,
  "safe-browsing": Radar,
  virustotal: Bug,
};

/**
 * Status presentation. Readers see four distinct states, each with its own word, icon and colour:
 * Passed (nothing concerning), Warning (minor signs, worth checking), Failed (a serious problem)
 * and Unavailable (the check could not run: unknown, never safe).
 */
export const STATUS_META = {
  pass: {
    label: "Passed",
    tone: "success",
    icon: Check,
    severity: "None",
    accent: "var(--ss-success)",
    action: null,
  },
  info: {
    label: "Info",
    tone: "primary",
    icon: Info,
    severity: "Informational",
    accent: "var(--ss-primary)",
    action: null,
  },
  warn: {
    label: "Warning",
    tone: "warning",
    icon: TriangleAlert,
    severity: "Medium",
    accent: "var(--ss-warning)",
    action: "Verify this independently, for example by typing the official address yourself, before you trust the site.",
  },
  fail: {
    label: "Failed",
    tone: "danger",
    icon: CircleX,
    severity: "High",
    accent: "var(--ss-danger)",
    action: "Treat this as a serious warning. Do not sign in, pay or download anything from this site.",
  },
  unavailable: {
    label: "Unavailable",
    tone: "neutral",
    icon: CircleHelp,
    severity: "Unknown",
    accent: "var(--ss-subtle)",
    action: "Treat this as unknown, not as safe. Run the scan again later.",
  },
  optional: {
    label: "Not used",
    tone: "neutral",
    icon: CircleSlash,
    severity: "None",
    accent: "var(--ss-subtle)",
    action: null,
  },
  skipped: {
    label: "Unavailable",
    tone: "neutral",
    icon: CircleSlash,
    severity: "Not checked",
    accent: "var(--ss-subtle)",
    action: "Treat this as unknown, not as safe.",
  },
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.info;
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone}>
      <Icon className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

/** Small status-coloured icon tile used in check lists. */
export function CheckIcon({ id, status, small = false, className }) {
  const Icon = CHECK_ICONS[id] || ScanSearch;
  const meta = STATUS_META[status] || STATUS_META.info;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-xl", small ? "size-9" : "size-10", className)}
      style={{ background: `color-mix(in srgb, ${meta.accent} 14%, transparent)`, color: meta.accent }}
      aria-hidden="true"
    >
      <Icon className="size-5" strokeWidth={1.9} />
    </span>
  );
}

function SectionLabel({ children }) {
  return <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-subtle">{children}</p>;
}

/** Label and value rows. Used for the technical evidence of a check. */
export function EvidenceList({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-2/40 text-sm">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="grid gap-0.5 px-3 py-2 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
          <dt className="font-medium text-muted">{item.label}</dt>
          <dd className="min-w-0 break-words font-mono text-[0.8rem] leading-relaxed text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The full explanation of one check, in the order a reader asks the questions:
 * what was checked, what the result means, why it matters, what to do. Evidence stays collapsed.
 */
export function CheckDetail({ check, id }) {
  const meta = STATUS_META[check.status] || STATUS_META.info;
  const [showEvidence, setShowEvidence] = useState(false);
  const action = check.action ?? meta.action;
  const points = check.findings.reduce((sum, finding) => sum + finding.points, 0);
  const evidenceId = `${id || `detail-${check.id}`}-evidence`;

  return (
    <div id={id} className="grid gap-5 md:grid-cols-2">
      <div className="space-y-5">
        {check.what ? (
          <div>
            <SectionLabel>What we checked</SectionLabel>
            <p className="text-sm leading-relaxed text-fg/90">{check.what}</p>
          </div>
        ) : null}
        <div>
          <SectionLabel>What the result means</SectionLabel>
          <p className="text-sm leading-relaxed text-fg/90">{check.summary}</p>
          {check.findings.length > 0 ? (
            <ul className="mt-2.5 space-y-1.5" aria-label="Findings">
              {check.findings.map((finding, index) => (
                <li key={`${finding.code}-${index}`} className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: meta.accent }} strokeWidth={2} aria-hidden="true" />
                  <span className="min-w-0 break-words text-fg/90">{finding.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {points > 0 ? (
            <p className="mt-2 text-xs text-muted">
              Adds {points} point{points === 1 ? "" : "s"} to the risk score.
            </p>
          ) : check.status === "unavailable" ? (
            <p className="mt-2 text-xs text-muted">Adds no points to the risk score, and is not counted as safe.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <SectionLabel>Why it matters</SectionLabel>
          <p className="text-sm leading-relaxed text-muted">{check.matters || check.explanation}</p>
        </div>
        {action ? (
          <div className="flex gap-3 rounded-xl bg-primary-soft px-3.5 py-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-ink" strokeWidth={2} aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-primary-ink">What to do next</p>
              <p className="mt-1 text-sm text-fg/90">{action}</p>
            </div>
          </div>
        ) : null}
        {check.evidence.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setShowEvidence((value) => !value)}
              aria-expanded={showEvidence}
              aria-controls={evidenceId}
              className="no-print inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary-ink hover:underline"
            >
              {showEvidence ? "Hide" : "Show"} technical evidence
              <ChevronDown className={cn("size-4 transition-transform", showEvidence ? "rotate-180" : "")} strokeWidth={2} aria-hidden="true" />
            </button>
            <div id={evidenceId} className={cn("print-open mt-2", showEvidence ? "block" : "hidden")}>
              <EvidenceList items={check.evidence} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
