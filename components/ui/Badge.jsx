import { cn } from "@/lib/utils/cn";

const NEUTRAL = "bg-surface-2 text-muted ring-line";

const TONES = {
  neutral: NEUTRAL,
  primary: "bg-primary-soft text-primary-ink ring-primary/20",
  accent: "bg-accent-soft text-accent ring-accent/25",
  success: "bg-success-soft text-success-fg ring-success/25",
  warning: "bg-warning-soft text-warning-fg ring-warning/25",
  danger: "bg-danger-soft text-danger-fg ring-danger/25",
  // Legacy names kept so existing call sites keep working.
  white: NEUTRAL,
  paper: NEUTRAL,
  blue: "bg-primary-soft text-primary-ink ring-primary/20",
  mint: "bg-success-soft text-success-fg ring-success/25",
  pink: "bg-danger-soft text-danger-fg ring-danger/25",
  ink: NEUTRAL,
};

export function Badge({ tone = "neutral", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone] || NEUTRAL,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
