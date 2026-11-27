import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./Logo";

const GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/check", label: "Scan a website" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#checks", label: "Security checks" },
      { href: "/#score", label: "Risk score" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/history", label: "Scan history" },
    ],
  },
  {
    title: "Report fraud",
    links: [
      { href: "/report-website", label: "Report a suspicious site" },
      { href: "https://reportfraud.ftc.gov/", label: "FTC ReportFraud", external: true },
      { href: "https://www.ic3.gov/", label: "FBI IC3", external: true },
      { href: "https://cybercrime.gov.in/", label: "India Cybercrime Portal", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print bg-[#0b1120] text-slate-300">
      <div className="mx-auto grid max-w-[var(--ss-content-max)] gap-12 px-4 pb-12 pt-16 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            A rule-based website scanner. Every score is explained, every check shows its evidence, and missing data is never
            counted as safe.
          </p>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-sm font-semibold text-white">{group.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                      <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[var(--ss-content-max)] flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>ScamShield AI · Scan before you trust.</p>
          <p className="max-w-xl md:text-right">
            Results are automated indicators, not a guarantee. A low score does not prove a site is safe, and a high score is
            not a legal finding.
          </p>
        </div>
      </div>
    </footer>
  );
}
