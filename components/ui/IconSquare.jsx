import { cn } from "@/lib/utils/cn";

const SIZES = {
  sm: { box: "size-8 rounded-lg", icon: "size-4" },
  md: { box: "size-10 rounded-xl", icon: "size-5" },
  lg: { box: "size-12 rounded-xl", icon: "size-6" },
};

const PRIMARY = "bg-primary-soft text-primary-ink";

const TONES = {
  primary: PRIMARY,
  accent: "bg-accent-soft text-accent",
  neutral: "bg-surface-2 text-muted",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger: "bg-danger-soft text-danger-fg",
  // Legacy names kept so existing call sites keep working.
  white: "bg-surface-2 text-muted",
  mint: "bg-success-soft text-success-fg",
  pink: "bg-danger-soft text-danger-fg",
  blue: PRIMARY,
  ink: "bg-surface-2 text-fg",
};

/** The consistent icon treatment: a lucide icon on a soft tinted tile (primary by default). */
export function IconSquare({ icon: Icon, size = "md", tone = "primary", className }) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", TONES[tone] || PRIMARY, s.box, className)} aria-hidden="true">
      <Icon className={s.icon} strokeWidth={1.9} />
    </span>
  );
}
