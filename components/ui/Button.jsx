import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ss-ring)]";

const PRIMARY = "bg-primary text-white shadow-[0_1px_2px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-primary-hover";
const SECONDARY = "border border-line-strong bg-surface text-fg shadow-xs hover:border-subtle hover:bg-surface-2";
const DANGER = "bg-danger text-white hover:brightness-110";

const VARIANTS = {
  primary: PRIMARY,
  secondary: SECONDARY,
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  soft: "bg-primary-soft text-primary-ink hover:brightness-110",
  danger: DANGER,
  dark: "bg-[#0f172a] text-white hover:bg-[#1e293b]",
  // Legacy names kept so existing call sites keep working.
  blue: PRIMARY,
  pink: DANGER,
  ink: "bg-[#0f172a] text-white hover:bg-[#1e293b]",
};

const SIZES = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[0.9375rem]",
};

export function buttonClasses({ variant = "primary", size = "md", className } = {}) {
  return cn(BASE, VARIANTS[variant] || VARIANTS.primary, SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, children, ...props }) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
