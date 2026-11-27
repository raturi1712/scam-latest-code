import { cn } from "@/lib/utils/cn";

const TONES = {
  white: "border-line bg-surface",
  subtle: "border-line bg-surface-2",
  primary: "border-transparent bg-primary-soft",
  success: "border-transparent bg-success-soft",
  danger: "border-transparent bg-danger-soft",
  // Legacy names kept so existing call sites keep working.
  accent: "border-transparent bg-primary-soft",
  blue: "border-transparent bg-primary text-white",
  pink: "border-transparent bg-danger-soft",
  mint: "border-transparent bg-success-soft",
  periwinkle: "border-line bg-surface-2",
  paper: "border-line bg-surface-2",
};

const SHADOWS = {
  none: "",
  sm: "shadow-card",
  md: "shadow-card",
  lg: "shadow-raised",
};

export function Card({ as: Tag = "div", tone = "white", shadow = "md", className, children, ...props }) {
  return (
    <Tag className={cn("rounded-2xl border", TONES[tone] || TONES.white, SHADOWS[shadow], className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, action, eyebrow, description, className }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-medium text-muted">{eyebrow}</p> : null}
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
