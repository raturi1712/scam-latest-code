import {
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  Check,
  ChevronDown,
  EyeOff,
  FileSearch,
  Flag,
  Globe,
  History,
  Link2,
  ListChecks,
  Lock,
  Network,
  Radar,
  Scale,
  ScanSearch,
  Server,
  ShieldCheck,
  UserRoundX,
} from "lucide-react";
import { HeroScan } from "@/components/scan/HeroScan";
import { LEVEL_COLORS, LEVEL_ICONS } from "@/components/scan/RiskBadge";
import { SampleFinding, SampleReport } from "@/components/scan/SampleReport";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconSquare } from "@/components/ui/IconSquare";
import { RISK_LEVELS } from "@/lib/scoring/levels";

const STATS = [
  {
    value: "$16.6B",
    label: "reported lost to internet crime in the US in 2024, up 33% in a year",
    source: "FBI IC3 2024 Internet Crime Report",
  },
  {
    value: "193,407",
    label: "phishing and spoofing complaints in 2024, the most reported crime type",
    source: "FBI IC3 2024 Internet Crime Report",
  },
  {
    value: "$3.5B",
    label: "reported lost to imposter scams in 2025, nearly triple the 2020 figure",
    source: "US Federal Trade Commission, 2026",
  },
  {
    value: "~1 in 3",
    label: "fraud reports to the FTC in 2025 were about imposter scams, the most reported category",
    source: "US Federal Trade Commission, 2026",
  },
];

const STEPS = [
  {
    icon: Link2,
    title: "Paste a link",
    text: "Drop in any web address from an email, text, ad or search result. You do not need to open the site yourself.",
  },
  {
    icon: Radar,
    title: "We run live checks",
    text: "Our server contacts registries, DNS and the site itself, following each redirect safely and never running the site's code.",
  },
  {
    icon: ListChecks,
    title: "Read the evidence",
    text: "You get a 0 to 100 risk score, the reason for every point, the raw evidence behind each check and clear next steps.",
  },
];

const CHECKS = [
  { icon: CalendarClock, title: "Domain age", text: "Registration date, expiry and registrar from RDAP. Scam domains are usually days or weeks old." },
  { icon: Lock, title: "SSL certificate", text: "Validity, issuer, expiry and hostname match. A valid certificate is never treated as proof of trust." },
  { icon: UserRoundX, title: "Brand impersonation", text: "Typos, look-alike characters and brand names glued onto unrelated domains, compared with official ones." },
  { icon: ArrowRightLeft, title: "Redirect chain", text: "Every hop from the link to its final destination, with downgrades and cross-domain jumps flagged." },
  { icon: Network, title: "DNS records", text: "Address, mail and name-server records, plus SPF and DMARC email authentication." },
  { icon: Server, title: "IP and hosting", text: "Where the site is really hosted: network owner, range, country and reverse DNS." },
  { icon: ScanSearch, title: "URL patterns", text: "Raw IP addresses, hidden '@' tricks, stacked urgency words, abused endings and risky downloads." },
  { icon: Link2, title: "Link shorteners", text: "Short links are expanded so you can see, and we can scan, the real destination." },
  { icon: Globe, title: "HTTP response", text: "Whether the site is online, what it answers with and which security headers it sends." },
  { icon: FileSearch, title: "Page signals", text: "Login forms that post to other domains or pose as a known brand. Read as text, never executed." },
  { icon: Radar, title: "Google Safe Browsing", text: "Whether Google has flagged the address for phishing or malware, when the site owner has added an API key." },
];

const STRIP = ["Domain age", "SSL certificate", "DNS records", "Redirects", "Brand impersonation", "Hosting", "Blocklists"];

const REPORT_POINTS = [
  { icon: Scale, title: "Every point is explained", text: "The score is a sum of fixed, published rules. See exactly which finding added which points." },
  { icon: FileSearch, title: "Evidence you can check", text: "Registry dates, certificate details, DNS records and redirect hops, shown as collected." },
  { icon: ListChecks, title: "Clear next steps", text: "Each finding says why it matters and what to do, in plain language." },
];

const PRINCIPLES = [
  {
    icon: Lock,
    title: "HTTPS is not a trust signal",
    text: "Most phishing sites have a padlock. A valid certificate scores exactly zero here: it never lowers the risk.",
  },
  {
    icon: EyeOff,
    title: "Unknown is not safe",
    text: "When a check cannot run, it is marked unavailable and adds a little uncertainty. It is never quietly counted as a pass.",
  },
  {
    icon: Scale,
    title: "Nothing subtracts points",
    text: "The score only goes up when a check finds a warning sign, so a clean result is earned, not assumed.",
  },
];

const FAQ = [
  {
    q: "Do I need an account to scan a website?",
    a: "No. Anyone can scan a link from the homepage or the scanner page. A free account adds a saved scan history, a dashboard and one-click rescans.",
  },
  {
    q: "Do I have to open the suspicious site myself?",
    a: "No. The scan runs on our server, which follows redirects safely and reads responses as text. Nothing from the scanned page is ever executed in your browser.",
  },
  {
    q: "What does the risk score mean?",
    a: "It is a number from 0 to 100, made by adding up fixed points for each warning sign the checks find. 0 to 14 is Low Risk, 15 to 34 Some Caution, 35 to 64 Suspicious and 65 or more High Risk.",
  },
  {
    q: "Does a low score prove a site is safe?",
    a: "No. A low score means the checks that ran found no meaningful warning signs. Websites change, and no scanner can guarantee a site is trustworthy, so stay alert for unusual requests.",
  },
  {
    q: "Why doesn't a valid HTTPS certificate lower the score?",
    a: "Because certificates are free and most phishing sites have one. Encryption protects the connection; it says nothing about who runs the site.",
  },
  {
    q: "What happens when a check cannot run?",
    a: "It is shown as unavailable in the report. For core checks a small number of points is added, because missing information is uncertainty, not a pass.",
  },
];

function SectionHeading({ eyebrow, title, description, id, align = "left" }) {
  const center = align === "center";
  return (
    <div className={center ? "mx-auto mb-12 max-w-2xl text-center" : "mb-12 max-w-2xl"}>
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 id={id} className="scroll-mt-24 text-3xl font-semibold tracking-tight text-fg sm:text-[2.5rem] sm:leading-[1.15]">
        {title}
      </h2>
      {description ? <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">{description}</p> : null}
    </div>
  );
}

const WRAP = "mx-auto max-w-(--ss-content-max) px-4 sm:px-6 lg:px-8";

export default function LandingPage() {
  return (
    <>
      {/* 1-4. Hero with scanner and report preview */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(65%_70%_at_70%_30%,#000,transparent)]" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-40 -top-56 size-[44rem] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(37 99 235 / 0.16), transparent 65%)" }}
          aria-hidden="true"
        />
        <div className={`${WRAP} relative grid grid-cols-1 items-center gap-14 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12 lg:py-24`}>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[0.8125rem] font-medium text-muted shadow-xs">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
                <span className="relative size-2 rounded-full bg-success" />
              </span>
              Website security and scam detection
            </p>
            <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.03em] text-fg sm:text-[3.25rem] lg:text-[3.75rem]">
              Don&apos;t trust the link.
              <br />
              <span className="bg-linear-to-r from-[#2563eb] to-[#0891b2] bg-clip-text text-transparent">Verify it first.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              ScamShield AI analyzes website domains, SSL certificates, DNS, redirects and hosting signals to help identify
              suspicious websites.
            </p>
            <div className="mt-8 max-w-xl">
              <HeroScan />
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              {["No account needed", "12 security checks", "Evidence for every result"].map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-sm text-muted">
                  <Check className="size-4 text-success-fg" strokeWidth={2.25} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <SampleReport />
          </div>
        </div>

        {/* Checks strip */}
        <div className="relative border-t border-line bg-canvas/70">
          <div className={`${WRAP} flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-5 lg:justify-between`}>
            <p className="text-sm font-medium text-fg">Every scan inspects</p>
            {STRIP.map((item) => (
              <span key={item} className="inline-flex items-center gap-2 text-sm text-muted">
                <span className="size-1.5 rounded-full bg-primary/60" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Sample report walkthrough */}
      <section className="bg-canvas" aria-labelledby="report-heading">
        <div className={`${WRAP} grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:py-24`}>
          <div className="min-w-0">
            <SectionHeading
              id="report-heading"
              eyebrow="Inside a report"
              title="Not just a verdict. The reasons behind it."
              description="Every report breaks the score down into individual findings you can read, verify and act on."
            />
            <ul className="-mt-4 space-y-6">
              {REPORT_POINTS.map((point) => (
                <li key={point.title} className="flex gap-4">
                  <IconSquare icon={point.icon} />
                  <div>
                    <h3 className="text-base font-semibold text-fg">{point.title}</h3>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">{point.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <SampleFinding />
        </div>
      </section>

      {/* 5. Why it matters */}
      <section className="border-y border-line bg-surface" aria-labelledby="stats-heading">
        <div className={`${WRAP} py-20 lg:py-24`}>
          <SectionHeading
            id="stats-heading"
            eyebrow="Why website security matters"
            title="Fake websites are the front door of online fraud"
            description="Phishing and imposter scams are among the most reported crimes. Checking a link takes seconds; recovering from a scam can take months."
          />
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.value} className="flex flex-col bg-surface px-6 py-7">
                <p className="text-[2.5rem] font-semibold leading-none tracking-tight text-fg">{stat.value}</p>
                <p className="mt-4 flex-1 text-[0.9375rem] leading-relaxed text-muted">{stat.label}</p>
                <p className="mt-6 text-xs text-subtle">Source: {stat.source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. How it works */}
      <section className="bg-canvas" aria-labelledby="how-it-works">
        <div className={`${WRAP} py-20 lg:py-24`}>
          <SectionHeading
            id="how-it-works"
            align="center"
            eyebrow="How scanning works"
            title="Three steps, about fifteen seconds"
            description="You never have to visit the suspicious site. The scan happens on our server, behind strict safety limits."
          />
          <div className="relative">
            <div className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-linear-to-r from-transparent via-line-strong to-transparent md:block" aria-hidden="true" />
            <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex flex-col items-center text-center">
                  <span className="relative inline-flex size-20 items-center justify-center rounded-2xl border border-line bg-surface shadow-raised">
                    <step.icon className="size-7 text-primary" strokeWidth={1.75} aria-hidden="true" />
                    <span className="absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white ring-4 ring-canvas">
                      {index + 1}
                    </span>
                  </span>
                  <h3 className="mt-6 text-lg font-semibold text-fg">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 7. Security checks */}
      <section className="border-y border-line bg-surface" aria-labelledby="checks">
        <div className={`${WRAP} py-20 lg:py-24`}>
          <SectionHeading
            id="checks"
            eyebrow="Security checks explained"
            title="What every scan checks"
            description="Each check is reported separately with its status, the evidence collected and a plain-language explanation."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((check) => (
              <Card key={check.title} shadow="none" className="group flex gap-4 p-5 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-raised">
                <IconSquare icon={check.icon} />
                <div>
                  <h3 className="text-[0.9375rem] font-semibold text-fg">{check.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{check.text}</p>
                </div>
              </Card>
            ))}
            <div className="theme-dark flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
              <div className="flex gap-4">
                <IconSquare icon={ShieldCheck} tone="accent" />
                <div>
                  <h3 className="text-[0.9375rem] font-semibold text-fg">Built to scan safely</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Private and internal addresses are blocked, every redirect is re-validated, responses are size-limited and
                    nothing from a scanned page is ever executed.
                  </p>
                </div>
              </div>
              <p className="text-xs font-medium text-accent">SSRF protected · Rate limited</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Risk score */}
      <section className="bg-canvas" aria-labelledby="score">
        <div className={`${WRAP} py-20 lg:py-24`}>
          <SectionHeading
            id="score"
            eyebrow="Risk score explained"
            title="A score you can audit"
            description="No black box. The score is the sum of fixed rules, from 0 (no warning signs found) to 100."
          />

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-8">
            <div className="flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden="true">
              {RISK_LEVELS.map((level) => (
                <div key={level.id} style={{ width: `${level.max - level.min + 1}%`, background: LEVEL_COLORS[level.id].solid }} />
              ))}
            </div>
            <div className="mt-2 hidden justify-between text-xs tabular-nums text-subtle sm:flex" aria-hidden="true">
              <span>0</span>
              <span>100</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {RISK_LEVELS.map((level) => {
                const Icon = LEVEL_ICONS[level.id];
                const color = LEVEL_COLORS[level.id];
                return (
                  <div key={level.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold" style={{ color: color.fg }}>
                        <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden="true" />
                        {level.label}
                      </h3>
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium tabular-nums text-muted">
                        {level.min}–{level.max}
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">{level.blurb}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <div key={item.title} className="flex gap-4">
                <IconSquare icon={item.icon} tone="neutral" />
                <div>
                  <h3 className="text-[0.9375rem] font-semibold text-fg">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Report a suspicious website */}
      <section className="border-y border-line bg-surface" aria-labelledby="cta-heading">
        <div className={`${WRAP} grid grid-cols-1 gap-6 py-20 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:py-24`}>
          <div className="theme-dark relative overflow-hidden rounded-3xl border border-line bg-canvas px-7 py-10 sm:px-10 sm:py-12">
            <div
              className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgb(59 130 246 / 0.35), transparent 65%)" }}
              aria-hidden="true"
            />
            <div className="relative">
              <IconSquare icon={Flag} size="lg" />
              <h2 id="cta-heading" className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Spotted a scam site? Report it.
              </h2>
              <p className="mt-3 max-w-lg text-[1.0625rem] leading-relaxed text-muted">
                Reports are open to everyone and take about a minute. No account required. Every report helps build a picture of
                active scams.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/report-website" size="lg">
                  Report a suspicious website
                  <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden="true" />
                </ButtonLink>
              </div>
            </div>
          </div>
          <Card shadow="none" className="flex flex-col justify-between gap-8 rounded-3xl px-7 py-10 sm:px-10 sm:py-12">
            <div>
              <IconSquare icon={History} size="lg" tone="accent" />
              <h2 className="mt-6 text-2xl font-semibold tracking-tight text-fg">Keep every scan in one place</h2>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
                A free account saves your reports, charts your results and lets you rescan any site with one click.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <ButtonLink href="/register">Create free account</ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                Sign in
              </ButtonLink>
            </div>
          </Card>
        </div>
      </section>

      {/* 10. FAQ */}
      <section className="bg-canvas" aria-labelledby="faq">
        <div className={`${WRAP} grid grid-cols-1 gap-10 py-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-24`}>
          <SectionHeading
            id="faq"
            eyebrow="FAQ"
            title="Questions, answered"
            description="How the scanner works, what the score means and what it can't tell you."
          />
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 sm:px-6">
                <summary className="flex list-none items-center justify-between gap-4 py-5 text-left text-[0.9375rem] font-medium text-fg">
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-subtle transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden="true" />
                </summary>
                <p className="-mt-1 pb-5 text-[0.9375rem] leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
