"use client";

import Link from "next/link";
import { CircleCheck, CircleHelp, Download, ExternalLink, Flag, Link2, ListChecks, RefreshCw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconSquare } from "@/components/ui/IconSquare";
import { useToast } from "@/components/ui/Toast";
import { getLevel } from "@/lib/scoring/levels";
import { formatDateTime } from "@/lib/utils/format";
import { AdvancedDetails } from "./AdvancedDetails";
import { DomainIntelligence } from "./DomainIntelligence";
import { LEVEL_COLORS, LEVEL_ICONS, RiskScale } from "./RiskBadge";
import { buildSignals, checkLabel, getDomainInfo, splitChecks, tallyChecks } from "./report-utils";
import { SecurityChecks } from "./SecurityChecks";

function Chip({ tone = "neutral", children }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    success: "bg-success-soft text-success-fg",
    warning: "bg-warning-soft text-warning-fg",
    danger: "bg-danger-soft text-danger-fg",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function SignalList({ title, icon: Icon, tone, items, empty }) {
  const color = tone === "success" ? "text-success-fg" : "text-warning-fg";
  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Icon className={`size-4 ${color}`} strokeWidth={2.25} aria-hidden="true" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2.5 text-sm leading-relaxed text-muted">{empty}</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 text-sm leading-snug text-fg/90">
              <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} strokeWidth={2.25} aria-hidden="true" />
              <span className="min-w-0 break-words">{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The scan report, in the order a reader asks questions: what is the verdict, who is behind the domain,
 * what stood out, what exactly was checked, what should I do. Technical detail is collapsed at the end.
 * `shareUrl` is what "Copy report link" copies.
 */
export function ScanReport({ scan, onRescan, rescanning = false, shareUrl }) {
  const toast = useToast();
  const level = getLevel(scan.level);
  const color = LEVEL_COLORS[scan.level];
  const LevelIcon = LEVEL_ICONS[scan.level];
  const redirected = scan.finalUrl && scan.finalUrl !== scan.url;

  const { main, technical } = splitChecks(scan.checks);
  const tally = tallyChecks(main);
  const domainInfo = getDomainInfo(scan, main);
  const { positives, concerns } = buildSignals(main, technical, domainInfo);

  async function copyLink() {
    const link = shareUrl || window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Report link copied to clipboard.");
    } catch {
      toast.error("Could not copy automatically. Copy the address from your browser bar.");
    }
  }

  return (
    <div className="space-y-6">
      {/* A. Main security summary */}
      <Card as="section" shadow="lg" className="overflow-hidden" aria-labelledby="verdict-heading">
        <div className="grid lg:grid-cols-[16rem_1fr]">
          <div
            className="flex flex-col justify-center gap-4 border-b border-line px-6 py-6 lg:border-b-0 lg:border-r lg:py-8"
            style={{ background: `linear-gradient(180deg, ${color.soft}, transparent 85%)` }}
          >
            <div>
              <p className="text-xs font-medium text-subtle">Risk score</p>
              <p className="mt-1 flex items-baseline gap-1.5" aria-label={`Risk score ${scan.score} out of 100`}>
                <span className="text-6xl font-semibold leading-none tracking-tight tabular-nums" style={{ color: color.fg }}>
                  {scan.score}
                </span>
                <span className="text-lg font-medium text-subtle">/ 100</span>
              </p>
            </div>
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: color.soft, color: color.fg }}
            >
              <LevelIcon className="size-4" strokeWidth={2.25} aria-hidden="true" />
              {level.label}
            </span>
            <RiskScale score={scan.score} showLabels={false} />
          </div>

          <div className="flex min-w-0 flex-col gap-4 px-5 py-6 sm:px-7">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">Scanned website</p>
              <h2 id="verdict-heading" className="mt-0.5 break-all text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                {scan.domain}
              </h2>
              <p className="mt-1 break-all font-mono text-xs text-subtle">
                {scan.url}
                {redirected ? <span className="font-sans"> · ends at </span> : null}
                {redirected ? scan.finalUrl : null}
              </p>
            </div>

            <p className="text-[0.9375rem] leading-relaxed text-fg/90">{scan.summary}</p>

            <div className="flex flex-wrap items-center gap-2" aria-label="Check results summary">
              <Chip>
                <strong className="font-semibold text-fg">
                  {tally.completed} of {tally.total}
                </strong>{" "}
                checks completed
              </Chip>
              <Chip tone={tally.passed > 0 ? "success" : "neutral"}>{tally.passed} passed</Chip>
              <Chip tone={tally.warnings > 0 ? "warning" : "neutral"}>
                {tally.warnings} warning{tally.warnings === 1 ? "" : "s"}
              </Chip>
              <Chip tone={tally.failed > 0 ? "danger" : "neutral"}>{tally.failed} failed</Chip>
              {tally.unavailable.length > 0 ? <Chip>{tally.unavailable.length} unavailable</Chip> : null}
              <span className="ml-auto text-xs text-subtle">
                Scanned <time dateTime={scan.scannedAt}>{formatDateTime(scan.scannedAt)}</time>
              </span>
            </div>
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2.5 border-t border-line bg-surface-2/40 px-5 py-4 sm:px-7">
          {onRescan ? (
            <Button onClick={onRescan} loading={rescanning}>
              {rescanning ? null : <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />}
              Rescan
            </Button>
          ) : null}
          <Button variant="secondary" onClick={copyLink}>
            <Link2 className="size-4" strokeWidth={2} aria-hidden="true" />
            Copy report link
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Download className="size-4" strokeWidth={2} aria-hidden="true" />
            Export PDF
          </Button>
          <ButtonLink variant="ghost" href={`/report-website?url=${encodeURIComponent(scan.url)}`} className="sm:ml-auto">
            <Flag className="size-4" strokeWidth={2} aria-hidden="true" />
            Report this site
          </ButtonLink>
        </div>
      </Card>

      {tally.unavailable.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong bg-surface/60 px-4 py-3" role="note">
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
          <p className="text-sm text-muted">
            <strong className="font-semibold text-fg">Some checks could not be completed.</strong>{" "}
            We could not check: {tally.unavailable.map(checkLabel).join(", ")}. We do not know the answer for{" "}
            {tally.unavailable.length === 1 ? "this check" : "these checks"}, so do not read the result as &quot;safe&quot;. Missing
            information never lowers or raises the risk score.
          </p>
        </div>
      ) : null}

      {/* B. Domain intelligence */}
      <DomainIntelligence info={domainInfo} domain={scan.domain} />

      {/* C. Important findings */}
      <Card as="section" aria-labelledby="signals-heading">
        <CardHeader
          title={<span id="signals-heading">Important findings</span>}
          description="What stood out, in plain words. Select a check below for the details."
        />
        <div className="grid gap-x-10 gap-y-6 px-5 py-5 sm:px-6 md:grid-cols-2">
          <SignalList
            title="Good signs"
            icon={CircleCheck}
            tone="success"
            items={positives}
            empty="None of the completed checks gave a clear good sign."
          />
          <SignalList
            title="Things to watch out for"
            icon={TriangleAlert}
            tone="warning"
            items={concerns}
            empty={
              tally.unavailable.length > 0
                ? "No warning signs in the checks that ran. Some checks could not run, so this is not the full picture."
                : "No warning signs were found in the checks that ran."
            }
          />
        </div>
      </Card>

      {/* D. Security checks */}
      <SecurityChecks checks={main} />

      {/* E. What to do next */}
      <Card as="section" aria-labelledby="rec-heading">
        <CardHeader title={<span id="rec-heading">What should you do next?</span>} action={<IconSquare icon={ListChecks} size="sm" />} />
        <ol className="space-y-1 px-3 py-3 sm:px-4">
          {scan.recommendations.map((text, index) => (
            <li key={index} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-fg/90">{text}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* F. Advanced technical details */}
      <AdvancedDetails scan={scan} main={main} technical={technical} />

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ExternalLink className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>
          This report is an automated, rule-based assessment made at the time shown above. Websites change, and no scanner can
          guarantee that a site is safe. Seen something wrong?{" "}
          <Link href={`/report-website?url=${encodeURIComponent(scan.url)}`} className="no-print font-medium text-primary-ink hover:underline">
            Report this website
          </Link>
          .
        </span>
      </p>
    </div>
  );
}
