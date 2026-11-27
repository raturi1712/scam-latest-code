import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/** Shield mark with a scan line through it: the product in one glyph. */
export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id="ss-logo-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 4.5 6.8v8.4c0 7 4.8 12.6 11.5 14.3 6.7-1.7 11.5-7.3 11.5-14.3V6.8L16 2.5Z" fill="url(#ss-logo-grad)" />
      <path d="M8.5 16h15" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" />
      <path d="m11.5 11.5 4.5-2 4.5 2" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="m11.5 20.5 4.5 2.2 4.5-2.2" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact = false, tone = "auto" }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 rounded-lg", className)}
      aria-label="ScamShield AI home"
    >
      <LogoMark />
      {compact ? null : (
        <span className={cn("text-[1.0625rem] font-semibold tracking-tight", tone === "light" ? "text-white" : "text-fg")}>
          ScamShield
          <span className="ml-1 font-medium text-primary">AI</span>
        </span>
      )}
    </Link>
  );
}
