"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Flag,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Plus,
  ScanSearch,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RiskBadge } from "@/components/scan/RiskBadge";
import { ButtonLink } from "@/components/ui/Button";
import { PageLoader, Spinner } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { signOut } from "@/lib/services/auth-service";
import { useScans } from "@/lib/services/use-scans";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/format";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/scan", label: "Scan website", icon: ScanSearch },
      { href: "/history", label: "Scan history", icon: History, match: ["/history", "/scans"] },
      { href: "/report-website", label: "Report a site", icon: Flag },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/profile", label: "Profile", icon: UserRound },
      // Account settings live in the security section of the profile page.
      { href: "/profile#security", label: "Settings", icon: Settings, match: [] },
    ],
  },
];

/** [path prefix, page title, parent crumb] */
const TITLES = [
  ["/dashboard", "Overview", null],
  ["/scans", "Scan report", { href: "/history", label: "Scan history" }],
  ["/scan", "Scan website", null],
  ["/history", "Scan history", null],
  ["/profile", "Profile", null],
];

function isActive(item, pathname) {
  return (item.match || [item.href]).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function Avatar({ account, className }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#3b82f6] to-[#06b6d4] font-semibold text-white",
        className,
      )}
      aria-hidden="true"
    >
      {initials(account.displayName)}
    </span>
  );
}

/** Closes a popover on outside click or Escape. */
function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

function SidebarContent({ pathname, account, preview, onNavigate, onSignOut }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo href="/dashboard" />
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-3 pb-6 pt-4" aria-label="App">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-subtle">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-primary-soft text-fg" : "text-muted hover:bg-hover hover:text-fg",
                      )}
                    >
                      {active ? <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                      <item.icon
                        className={cn("size-[1.125rem] shrink-0", active ? "text-primary-ink" : "text-subtle group-hover:text-muted")}
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar account={account} className="size-9 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{account.displayName}</p>
            <p className="truncate text-xs text-subtle">{account.email || "Preview mode"}</p>
          </div>
          {preview ? null : (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-hover hover:text-fg"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" strokeWidth={1.9} aria-hidden="true" />
            </button>
          )}
        </div>
        {preview ? (
          <Link
            href="/login"
            onClick={onNavigate}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <LogIn className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Sign-in setup
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Latest suspicious and high-risk results, loaded from the user's real scan history when the panel opens. */
function AlertsList({ onNavigate }) {
  const { scans, loading, error } = useScans();
  const alerts = scans.filter((scan) => scan.level === "high" || scan.level === "suspicious").slice(0, 5);

  if (loading) return <Spinner label="Loading alerts" className="px-4 py-6" />;
  if (error) return <p className="px-4 py-6 text-sm text-muted">Alerts could not be loaded.</p>;
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <ShieldCheck className="size-6 text-success-fg" strokeWidth={1.9} aria-hidden="true" />
        <p className="text-sm font-medium text-fg">No risky sites found</p>
        <p className="text-xs text-muted">Suspicious and high-risk scan results will appear here.</p>
      </div>
    );
  }
  return (
    <ul className="max-h-80 divide-y divide-line overflow-y-auto">
      {alerts.map((scan) => (
        <li key={scan.id}>
          <Link href={`/scans/${scan.id}`} onClick={onNavigate} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-hover">
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", scan.level === "high" ? "bg-risk-high" : "bg-risk-suspicious")}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{scan.domain}</p>
              <p className="mt-0.5 text-xs text-subtle">{timeAgo(scan.scannedAt)}</p>
            </div>
            <RiskBadge level={scan.level} score={scan.score} size="sm" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg",
          open ? "bg-surface-2 text-fg" : "",
        )}
        aria-label="Security alerts"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="size-[1.125rem]" strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open ? (
        <div className="fade-up absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-fg">Security alerts</p>
            <Link href="/history" onClick={() => setOpen(false)} className="text-xs font-medium text-primary-ink hover:underline">
              View history
            </Link>
          </div>
          <AlertsList onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

function ProfileMenu({ account, preview, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));
  const close = () => setOpen(false);
  const itemBase = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2";
  const item = `${itemBase} hover:text-fg`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1.5 transition-colors hover:bg-surface-2 sm:pr-2"
        aria-label={`Account menu for ${account.displayName}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Avatar account={account} className="size-8 text-xs" />
        <ChevronDown className="hidden size-4 text-subtle sm:block" strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <div className="fade-up absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar account={account} className="size-9 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{account.displayName}</p>
              <p className="truncate text-xs text-subtle">{account.email || "Preview mode"}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link href="/profile" onClick={close} className={item}>
            <UserRound className="size-4" strokeWidth={1.9} aria-hidden="true" />
            Profile
          </Link>
          <Link href="/profile#security" onClick={close} className={item}>
            <Settings className="size-4" strokeWidth={1.9} aria-hidden="true" />
            Settings
          </Link>
          <Link href="/history" onClick={close} className={item}>
            <History className="size-4" strokeWidth={1.9} aria-hidden="true" />
            Scan history
          </Link>
          <div className="my-1 h-px bg-line" />
          {preview ? (
            <Link href="/login" onClick={close} className={item}>
              <LogIn className="size-4" strokeWidth={1.9} aria-hidden="true" />
              Sign-in setup
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                close();
                onSignOut();
              }}
              className={`${itemBase} hover:text-danger-fg`}
            >
              <LogOut className="size-4" strokeWidth={1.9} aria-hidden="true" />
              Sign out
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Authenticated app frame: sidebar, top bar, guarded content area. Follows the light / dark theme set on <html>. */
export function AppShell({ children }) {
  const { account, loading, preview } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !account) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, account, pathname, router]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (loading || !account) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-fg">
        <PageLoader label={loading ? "Checking your session" : "Redirecting to sign in"} />
      </div>
    );
  }

  async function handleSignOut() {
    try {
      await signOut();
      toast.success("You have been signed out.");
      router.replace("/");
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }

  const [, title, parent] = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)) || [null, "ScamShield AI", null];
  const sidebarProps = { pathname, account, preview, onSignOut: handleSignOut };

  return (
    <div className="min-h-dvh bg-canvas text-fg lg:pl-(--ss-sidebar-width)">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-(--ss-sidebar-width) border-r border-line bg-sidebar lg:block">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-[#020617]/70 backdrop-blur-sm" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] border-r border-line bg-sidebar shadow-pop">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3.5 inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-fg"
              aria-label="Close menu"
            >
              <X className="size-5" strokeWidth={2} aria-hidden="true" />
            </button>
            <SidebarContent {...sidebarProps} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Top bar */}
      <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-(--ss-content-max) items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <Menu className="size-5" strokeWidth={2} aria-hidden="true" />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="hidden shrink-0 text-subtle sm:block">
                  <Link href="/dashboard" className="hover:text-fg">
                    ScamShield
                  </Link>
                </li>
                {parent ? (
                  <>
                    <li className="hidden shrink-0 text-subtle sm:block" aria-hidden="true">
                      <ChevronRight className="size-3.5" strokeWidth={2} />
                    </li>
                    <li className="hidden shrink-0 text-subtle sm:block">
                      <Link href={parent.href} className="hover:text-fg">
                        {parent.label}
                      </Link>
                    </li>
                  </>
                ) : null}
                <li className="hidden shrink-0 text-subtle sm:block" aria-hidden="true">
                  <ChevronRight className="size-3.5" strokeWidth={2} />
                </li>
                <li className="truncate font-semibold text-fg" aria-current="page">
                  {title}
                </li>
              </ol>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <ButtonLink href="/scan" size="sm" aria-label="New scan">
              <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
              <span className="hidden sm:inline">New scan</span>
            </ButtonLink>
            <ThemeToggle />
            <NotificationsMenu />
            <ProfileMenu account={account} preview={preview} onSignOut={handleSignOut} />
          </div>
        </div>
      </header>

      {preview ? (
        <div className="no-print border-b border-warning/20 bg-warning-soft" role="status">
          <p className="mx-auto max-w-(--ss-content-max) px-4 py-2.5 text-[0.8125rem] text-warning-fg sm:px-6 lg:px-8">
            <strong className="font-semibold">Preview mode.</strong>{" "}
            <span className="text-fg/80">
              Firebase is not connected, so sign-in is off and scan history is stored only in this browser. Add your credentials to{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">.env.local</code> to enable accounts.
            </span>
          </p>
        </div>
      ) : null}

      <main id="main" className="print-full mx-auto max-w-(--ss-content-max) px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        {children}
      </main>
    </div>
  );
}
