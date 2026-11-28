"use client";

import { useId, useState } from "react";
import { ArrowRight, CircleAlert, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { validateUrlInput } from "@/lib/utils/validation";

/**
 * URL input with a Scan button. Validates locally for instant feedback, then hands the
 * raw value to `onScan`; the server performs the authoritative validation.
 *
 * size="lg" renders the input and button inside one combined field (stacked on mobile).
 */
export function ScanForm({
  onScan,
  loading = false,
  size = "md",
  defaultValue = "",
  buttonLabel = "Scan website",
  label = "Website address",
  showLabel = false,
  className,
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState(null);
  const id = useId();
  const large = size === "lg";

  function handleSubmit(event) {
    event.preventDefault();
    const problem = validateUrlInput(value);
    setError(problem);
    if (!problem) onScan(value.trim());
  }

  const input = (
    <input
      id={id}
      type="text"
      inputMode="url"
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="Paste a link or domain"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        if (error) setError(null);
      }}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      disabled={loading}
      className={cn(
        "w-full min-w-0 bg-transparent text-fg outline-none placeholder:text-subtle disabled:cursor-not-allowed disabled:opacity-70",
        large ? "h-14 pl-12 pr-4 text-base sm:h-[3.75rem] sm:text-[1.0625rem]" : "h-10 pl-10 pr-3 text-[0.9375rem]",
      )}
    />
  );

  return (
    <form onSubmit={handleSubmit} noValidate className={className}>
      <label htmlFor={id} className={showLabel ? "mb-2 block text-sm font-medium text-fg" : "sr-only"}>
        {label}
      </label>

      {large ? (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-2xl border bg-surface p-2 shadow-raised transition-[border-color,box-shadow] sm:flex-row sm:items-center",
            error
              ? "border-danger ring-4 ring-danger/15"
              : "border-line-strong focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--ss-ring)]",
          )}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-subtle" strokeWidth={2} aria-hidden="true" />
            {input}
          </div>
          <Button type="submit" size="lg" loading={loading} className="shrink-0">
            {loading ? "Scanning" : buttonLabel}
            {loading ? null : <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden="true" />}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div
            className={cn(
              "relative flex-1 rounded-lg border bg-surface shadow-xs transition-[border-color,box-shadow]",
              error ? "border-danger" : "border-line-strong focus-within:border-primary focus-within:ring-4 focus-within:ring-[var(--ss-ring)]",
            )}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-[1.125rem] -translate-y-1/2 text-subtle" strokeWidth={2} aria-hidden="true" />
            {input}
          </div>
          <Button type="submit" size="md" loading={loading}>
            {loading ? "Scanning" : buttonLabel}
          </Button>
        </div>
      )}

      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2.5 flex items-start gap-1.5 text-sm font-medium text-danger-fg">
          <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </form>
  );
}
