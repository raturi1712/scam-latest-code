"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#checks", label: "Security checks" },
  { href: "/#score", label: "Risk score" },
  { href: "/#faq", label: "FAQ" },
  { href: "/report-website", label: "Report a site" },
];

export function SiteHeader() {
  const { user, preview, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const signedIn = Boolean(user) || preview;

  const actions = loading ? (
    <span className="h-9 w-40" aria-hidden="true" />
  ) : signedIn ? (
    <ButtonLink href="/dashboard" size="sm">
      Open dashboard
      <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
    </ButtonLink>
  ) : (
    <>
      <ButtonLink href="/login" variant="ghost" size="sm">
        Sign in
      </ButtonLink>
      <ButtonLink href="/register" size="sm">
        Get started
      </ButtonLink>
    </>
  );

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/80 bg-surface/80 backdrop-blur-lg supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex h-16 max-w-[var(--ss-content-max)] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {actions}
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle className="size-10" />
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-fg transition-colors hover:bg-surface-2 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" strokeWidth={2} aria-hidden="true" /> : <Menu className="size-5" strokeWidth={2} aria-hidden="true" />}
        </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-menu" className="border-t border-line bg-surface px-4 pb-5 pt-2 shadow-raised lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-[0.9375rem] font-medium text-fg hover:bg-surface-2"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line px-1 pt-4">{actions}</div>
        </div>
      ) : null}
    </header>
  );
}
