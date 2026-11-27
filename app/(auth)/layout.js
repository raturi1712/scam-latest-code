import Link from "next/link";
import { ArrowLeft, CalendarClock, Lock, UserRoundX } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { RiskGauge } from "@/components/scan/RiskBadge";

const POINTS = [
  { icon: CalendarClock, text: "Domain age from official registry data" },
  { icon: UserRoundX, text: "Look-alike and impersonation detection" },
  { icon: Lock, text: "Certificates checked, never blindly trusted" },
];

/** Two-column auth layout: form on the light site surface, dark command-centre panel beside it. */
export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:text-fg">
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
            Back to site
          </Link>
        </header>
        <main id="main" className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          {children}
        </main>
      </div>

      <aside className="theme-dark relative hidden overflow-hidden bg-canvas text-fg lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-14" aria-hidden="true">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_40%,#000,transparent)]" />
        <div
          className="pointer-events-none absolute -top-40 right-0 size-[34rem] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(59 130 246 / 0.45), transparent 65%)" }}
        />

        <div className="relative mx-auto w-full max-w-md">
          <p className="eyebrow text-accent">Scan before you trust</p>
          <p className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-5xl">
            A padlock is <span className="text-primary-ink">not proof.</span>
          </p>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
            Most phishing sites have HTTPS. ScamShield looks at who is behind a site, how old it is and where it really leads.
          </p>

          <div className="mt-10 rounded-2xl border border-line bg-surface/80 p-6 shadow-pop backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate font-mono text-xs text-muted">paypa1-account-verify.top</p>
              <span className="rounded-full bg-[rgb(225_29_72/0.16)] px-2 py-0.5 text-[0.6875rem] font-medium text-[#fda4af]">Sample</span>
            </div>
            <RiskGauge score={88} level="high" size="sm" className="mt-4" />
            <ul className="mt-6 space-y-2.5">
              {POINTS.map((point) => (
                <li key={point.text} className="flex items-center gap-3 text-sm text-fg/90">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
                    <point.icon className="size-4" strokeWidth={1.9} />
                  </span>
                  {point.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
