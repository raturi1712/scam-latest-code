import { CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconSquare } from "./IconSquare";

const ALERT_TONES = {
  error: { box: "border-danger/30 bg-danger-soft", icon: CircleAlert, iconColor: "text-danger-fg" },
  success: { box: "border-success/30 bg-success-soft", icon: CircleCheck, iconColor: "text-success-fg" },
  info: { box: "border-primary/25 bg-primary-soft", icon: Info, iconColor: "text-primary-ink" },
  neutral: { box: "border-line bg-surface-2", icon: Info, iconColor: "text-muted" },
};

export function Alert({ tone = "info", title, children, className, role }) {
  const config = ALERT_TONES[tone];
  const Icon = config.icon;
  return (
    <div
      role={role || (tone === "error" ? "alert" : "status")}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3.5", config.box, className)}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", config.iconColor)} strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 text-sm text-fg">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 text-muted" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className, bare = false }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-6 py-14 text-center",
        bare ? "" : "rounded-2xl border border-dashed border-line-strong bg-surface/60",
        className,
      )}
    >
      {icon ? <IconSquare icon={icon} size="lg" /> : null}
      <div>
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description ? <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading", className }) {
  return (
    <div className={cn("flex items-center gap-3 text-muted", className)} role="status">
      <LoaderCircle className="size-5 animate-spin text-primary" strokeWidth={2} aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} aria-hidden="true" />;
}

export function PageLoader({ label = "Loading" }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}
