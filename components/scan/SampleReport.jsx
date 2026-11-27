import { CalendarClock, Lightbulb, Lock, Network, UserRoundX } from "lucide-react";
import { StatusBadge } from "./CheckCard";
import { RiskGauge } from "./RiskBadge";

const ROWS = [
  { icon: UserRoundX, title: "Brand impersonation", note: "Imitates PayPal with a look-alike character", status: "fail", points: 40 },
  { icon: CalendarClock, title: "Domain age", note: "Registered 4 days ago", status: "fail", points: 35 },
  { icon: Network, title: "DNS records", note: "No DMARC email policy published", status: "warn", points: 5 },
  { icon: Lock, title: "SSL certificate", note: "Valid. Encryption is not proof of trust", status: "pass", points: 0 },
];

const ROW_TINT = {
  fail: "bg-danger-soft text-danger-fg",
  warn: "bg-warning-soft text-warning-fg",
  pass: "bg-success-soft text-success-fg",
};

/** Window chrome shared by the sample previews. */
function PreviewFrame({ url, children, className = "" }) {
  return (
    <div className={`theme-dark overflow-hidden rounded-2xl border border-[#22324b] bg-surface text-fg shadow-[0_40px_80px_-24px_rgb(15_23_42/0.45),0_0_0_1px_rgb(15_23_42/0.04)] ${className}`}>
      <div className="flex items-center gap-3 border-b border-line bg-sidebar px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#334155]" />
          <span className="size-2.5 rounded-full bg-[#334155]" />
          <span className="size-2.5 rounded-full bg-[#334155]" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-surface-2 px-2.5 py-1 font-mono text-[0.6875rem] text-muted">{url}</span>
        <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary-ink">
          Sample
        </span>
      </div>
      {children}
    </div>
  );
}

/** Decorative, clearly labelled example of a report. Static markup, not a real scan. */
export function SampleReport() {
  return (
    <figure className="relative mx-auto w-full max-w-[31rem]" aria-label="Illustration of a sample scan report">
      <PreviewFrame url="https://paypa1-account-verify.top/login">
        <div className="grid grid-cols-[auto_1fr] items-center gap-5 border-b border-line px-5 py-5">
          <RiskGauge score={88} level="high" size="xs" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-subtle">Verdict</p>
            <p className="mt-1 text-[0.9375rem] font-semibold leading-snug text-fg">Strong signs of a phishing site.</p>
            <p className="mt-1 text-[0.8125rem] leading-snug text-muted">Do not sign in or pay on this site.</p>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {ROWS.map((row) => (
            <li key={row.title} className="flex items-center gap-3 px-5 py-3">
              <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${ROW_TINT[row.status]}`} aria-hidden="true">
                <row.icon className="size-4" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight text-fg">{row.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{row.note}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.points > 0 ? <span className="text-[0.6875rem] font-semibold tabular-nums text-subtle">+{row.points}</span> : null}
                <StatusBadge status={row.status} />
              </div>
            </li>
          ))}
        </ul>
      </PreviewFrame>
    </figure>
  );
}

/** One expanded finding, as it appears in a real report. Static sample used on the landing page. */
export function SampleFinding() {
  return (
    <figure className="w-full min-w-0" aria-label="Illustration of one detailed finding from a sample report">
      <PreviewFrame url="Report · paypa1-account-verify.top">
        <div className="flex items-center gap-3.5 border-b border-line px-5 py-4" style={{ boxShadow: "inset 3px 0 0 var(--ss-danger)" }}>
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger-fg" aria-hidden="true">
            <UserRoundX className="size-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold text-fg">Brand impersonation</p>
            <p className="truncate text-sm text-muted">Imitates PayPal with a look-alike character</p>
          </div>
          <span className="hidden text-xs font-semibold tabular-nums text-muted sm:inline">+40 pts</span>
          <StatusBadge status="fail" />
        </div>
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-subtle">Severity</p>
              <p className="text-sm font-medium text-fg">
                High <span className="font-normal text-muted">· adds 40 points</span>
              </p>
            </div>
            <div>
              <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-subtle">Why it matters</p>
              <p className="text-sm leading-relaxed text-muted">
                Swapping one letter for a look-alike digit is a classic phishing trick. At a glance the address reads as the real
                brand.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-subtle">Evidence</p>
              <dl className="divide-y divide-line rounded-xl border border-line bg-surface-2/40 text-sm">
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-muted">Closest brand</dt>
                  <dd className="font-mono text-[0.8rem] text-fg">paypal.com</dd>
                </div>
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-muted">Difference</dt>
                  <dd className="font-mono text-[0.8rem] text-fg">l → 1</dd>
                </div>
              </dl>
            </div>
            <div className="flex gap-2.5 rounded-xl bg-primary-soft px-3 py-2.5">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-ink" strokeWidth={2} aria-hidden="true" />
              <p className="text-sm text-fg/90">Do not sign in. Type the official address yourself instead.</p>
            </div>
          </div>
        </div>
      </PreviewFrame>
    </figure>
  );
}
