"use client";

import { useId } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const CONTROL =
  "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-fg shadow-xs placeholder:text-subtle outline-none transition-[border-color,box-shadow] hover:border-subtle focus:border-primary focus:ring-4 focus:ring-[var(--ss-ring)] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25";

/**
 * Label + control + hint + error, wired together for assistive tech.
 * `children` is a render function receiving the props the control needs.
 */
export function Field({ label, hint, error, optional = false, className, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-fg">
        {label}
        {optional ? <span className="font-normal text-subtle">(optional)</span> : null}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && !error ? (
        <p id={hintId} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger-fg" role="alert">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }) {
  return <input className={cn(CONTROL, "h-11 text-[0.9375rem]", className)} {...props} />;
}

export function Textarea({ className, rows = 5, ...props }) {
  return <textarea rows={rows} className={cn(CONTROL, "resize-y text-[0.9375rem] leading-relaxed", className)} {...props} />;
}

export function Select({ className, size = "md", children, ...props }) {
  return (
    <div className="relative">
      <select
        className={cn(CONTROL, "appearance-none pr-10", size === "sm" ? "h-10 text-sm" : "h-11 text-[0.9375rem]", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  );
}
