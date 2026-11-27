"use client";

import { useState } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RISK_LEVELS } from "@/lib/scoring/levels";
import { cn } from "@/lib/utils/cn";
import { EvidenceList } from "./CheckCard";

function Group({ title, note, children }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/**
 * Everything technical, kept out of the way: hosting, DNS, HTTP, redirects, certificate details,
 * registry data and the exact scoring arithmetic. Collapsed by default, and always printed.
 */
export function AdvancedDetails({ scan, main, technical }) {
  const [open, setOpen] = useState(false);
  const find = (id) => [...main, ...technical].find((check) => check.id === id);
  const maxPoints = Math.max(1, ...scan.breakdown.map((item) => item.points));

  const groups = [
    { id: "ip", title: "Hosting and IP address" },
    { id: "dns", title: "DNS records" },
    { id: "http", title: "HTTP response" },
    { id: "redirects", title: "Redirect details" },
    { id: "ssl", title: "Certificate" },
    { id: "domain-age", title: "Registry record" },
    { id: "shortener", title: "Link shortener" },
  ]
    .map((group) => ({ ...group, check: find(group.id) }))
    .filter((group) => group.check && group.check.evidence.length > 0);

  return (
    <Card as="section" aria-labelledby="advanced-heading">
      <h2 id="advanced-heading">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="advanced-panel"
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2/40 sm:px-6"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted" aria-hidden="true">
            <Wrench className="size-4" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-fg">Advanced technical details</span>
            <span className="mt-0.5 block text-sm font-normal text-muted">IP address, DNS, HTTP, redirects, certificate and how the score was calculated.</span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-subtle transition-transform", open ? "rotate-180" : "")} strokeWidth={2} aria-hidden="true" />
        </button>
      </h2>

      <div id="advanced-panel" className={cn("print-open border-t border-line", open ? "block" : "hidden")}>
        <div className="grid gap-x-8 gap-y-7 px-5 py-6 sm:px-6 lg:grid-cols-2">
          {groups.map((group) => (
            <Group key={group.id} title={group.title}>
              <EvidenceList items={group.check.evidence} />
            </Group>
          ))}

          <div className="lg:col-span-2">
            <Group
              title="How the score was calculated"
              note="Points are added for each warning sign and nothing is ever subtracted. A check that could not run adds no points and is not counted as safe."
            >
              {scan.breakdown.length === 0 ? (
                <p className="text-sm text-muted">No check added risk points, so the score is 0.</p>
              ) : (
                <ul className="space-y-4">
                  {scan.breakdown.map((item) => (
                    <li key={item.checkId}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-fg">{item.title}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">
                          +{item.points}
                          {item.capped ? <span className="ml-1 text-xs font-normal text-muted">(capped)</span> : null}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(item.points / maxPoints) * 100}%` }} />
                      </div>
                      <ul className="mt-2 space-y-1 text-[0.8125rem] text-muted">
                        {item.reasons.map((reason, index) => (
                          <li key={`${reason.code}-${index}`} className="flex gap-2">
                            <span className="shrink-0 font-semibold tabular-nums text-fg/80">+{reason.points}</span>
                            <span>{reason.label}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                Score bands: {RISK_LEVELS.map((band) => `${band.min} to ${band.max} ${band.label}`).join(", ")}. The score is a maximum of 100.
              </p>
            </Group>
          </div>
        </div>
      </div>
    </Card>
  );
}
