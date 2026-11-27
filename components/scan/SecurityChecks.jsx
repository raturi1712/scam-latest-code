"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { CheckDetail, CheckIcon, STATUS_META, StatusBadge } from "./CheckCard";
import { checkLabel } from "./report-utils";

const LEGEND = [
  ["pass", "nothing concerning found"],
  ["warn", "worth a closer look"],
  ["fail", "a serious problem"],
  ["unavailable", "could not be checked, so unknown"],
];

/**
 * Compact grid of the main checks. Selecting a card opens its full explanation underneath;
 * technical evidence stays collapsed inside it. Problems are already listed under "Important findings",
 * so nothing opens by itself. Optional checks that were not used are not shown.
 */
export function SecurityChecks({ checks }) {
  const [openId, setOpenId] = useState(null);
  const selected = checks.find((check) => check.id === openId) || null;

  return (
    <Card as="section" aria-labelledby="checks-heading">
      <CardHeader
        title={<span id="checks-heading">Security checks</span>}
        description="Select a check to see what it looked at and what the result means."
      />
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted" aria-label="What the results mean">
          {LEGEND.map(([status, text]) => (
            <li key={status} className="flex items-center gap-1.5">
              <StatusBadge status={status} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <ul className="grid gap-3 md:grid-cols-2">
          {checks.map((check) => {
            const meta = STATUS_META[check.status] || STATUS_META.info;
            const isOpen = check.id === openId;
            return (
              <li key={check.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : check.id)}
                  aria-expanded={isOpen}
                  aria-controls="check-detail"
                  className={cn(
                    "flex h-full w-full items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-colors",
                    isOpen ? "border-primary bg-primary-soft/40" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2/50",
                  )}
                  style={isOpen ? undefined : { boxShadow: `inset 3px 0 0 ${meta.accent}` }}
                >
                  <CheckIcon id={check.id} status={check.status} small />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-fg">{checkLabel(check)}</span>
                      <StatusBadge status={check.status} />
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[0.8125rem] leading-snug text-muted">{check.summary}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <div id="check-detail" role="region" aria-label={`${checkLabel(selected)} details`} className="mt-4 rounded-xl border border-line bg-surface-2/30 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <h3 className="text-[0.9375rem] font-semibold text-fg">{checkLabel(selected)}</h3>
              <StatusBadge status={selected.status} />
            </div>
            <CheckDetail check={selected} id={`detail-${selected.id}`} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
