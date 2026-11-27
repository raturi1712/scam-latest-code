import { ArrowRightLeft, CalendarClock, Calculator, Lock, Network, ShieldCheck, UserRoundX } from "lucide-react";
import { Card } from "@/components/ui/Card";

const STEPS = [
  { icon: ShieldCheck, label: "Validating the address" },
  { icon: ArrowRightLeft, label: "Following redirects" },
  { icon: CalendarClock, label: "Reading domain registration (RDAP)" },
  { icon: Lock, label: "Inspecting the SSL certificate" },
  { icon: Network, label: "Looking up DNS records and IP network" },
  { icon: UserRoundX, label: "Comparing against impersonated brands" },
  { icon: Calculator, label: "Calculating the risk score" },
];

/** Shown while a scan is running. The list describes the work; it does not fake per-step progress. */
export function ScanProgress({ url }) {
  return (
    <Card shadow="lg" className="fade-up overflow-hidden" role="status" aria-live="polite">
      <div className="scan-sweep h-1 bg-primary/15" aria-hidden="true" />
      <div className="px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex items-center gap-4">
          <span className="relative inline-flex size-12 shrink-0 items-center justify-center" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-primary/25 [animation:ss-pulse-ring_1.8s_ease-out_infinite]" />
            <span className="relative inline-flex size-12 items-center justify-center rounded-full bg-primary-soft ring-1 ring-primary/30">
              <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">Scanning now</p>
            <p className="break-all text-lg font-semibold text-fg sm:text-xl">{url}</p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Running live checks against the site. This usually takes 5 to 20 seconds depending on how quickly the site and its
          registry respond.
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.label} className="flex items-center gap-2.5 rounded-lg bg-surface-2/70 px-3 py-2 text-sm text-fg/90">
              <step.icon className="size-4 shrink-0 text-primary-ink" strokeWidth={1.9} aria-hidden="true" />
              <span className="min-w-0 flex-1">{step.label}</span>
              <span
                className="size-1.5 shrink-0 animate-pulse rounded-full bg-accent"
                style={{ animationDelay: `${index * 180}ms` }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
