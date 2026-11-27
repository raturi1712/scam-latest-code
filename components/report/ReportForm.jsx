"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Lock, Send } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { submitReport } from "@/lib/services/scan-service";
import { REPORT_CATEGORIES, REPORT_REASONS, validateReport } from "@/lib/utils/validation";

const EMPTY = { url: "", category: "", reason: "", description: "", contactEmail: "", website: "" };
const DESCRIPTION_MAX = 2000;

export function ReportForm() {
  const params = useSearchParams();
  const [values, setValues] = useState({ ...EMPTY, url: params.get("url") || "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | submitting | success
  const [formError, setFormError] = useState(null);
  // Used with the honeypot as basic bot protection: real people take a few seconds to fill a form.
  const [openedAt] = useState(() => Date.now());
  const formRef = useRef(null);

  const set = (name) => (event) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    const problems = validateReport(values);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      // Move focus to the first invalid control so keyboard and screen-reader users land on it.
      requestAnimationFrame(() => formRef.current?.querySelector("[aria-invalid='true']")?.focus());
      return;
    }

    setStatus("submitting");
    try {
      await submitReport({ ...values, elapsedMs: Date.now() - openedAt });
      setStatus("success");
    } catch (error) {
      setStatus("idle");
      if (error.fields) setErrors(error.fields);
      setFormError(error.message);
    }
  }

  if (status === "success") {
    return (
      <Card shadow="lg" className="fade-up px-6 py-12 text-center sm:px-10" role="status">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-success-soft text-success-fg ring-8 ring-success-soft/50">
          <CircleCheck className="size-7" strokeWidth={1.9} aria-hidden="true" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold text-fg">Report received</h2>
        <p className="mx-auto mt-2 max-w-md text-[0.9375rem] text-muted">
          Thank you. Your report has been recorded and helps build a picture of active scams.
        </p>
        <p className="mx-auto mt-4 max-w-md rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
          If you lost money or shared financial details, also contact your bank and report it to your national fraud authority
          right away.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              setValues(EMPTY);
              setErrors({});
              setStatus("idle");
            }}
          >
            Report another site
          </Button>
          <ButtonLink href="/check">Scan a website</ButtonLink>
        </div>
      </Card>
    );
  }

  const submitting = status === "submitting";
  const remaining = DESCRIPTION_MAX - values.description.length;

  return (
    <Card shadow="lg">
      <div className="border-b border-line px-5 py-5 sm:px-8">
        <h2 className="text-base font-semibold text-fg">Report details</h2>
        <p className="mt-0.5 text-sm text-muted">Fields marked optional can be left blank.</p>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-7">
        {formError ? (
          <Alert tone="error" title="Your report was not sent">
            {formError}
          </Alert>
        ) : null}

        <Field label="Website URL" error={errors.url} hint="The address of the site you want to report.">
          {(props) => (
            <Input
              {...props}
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://suspicious-site.example"
              value={values.url}
              onChange={set("url")}
              disabled={submitting}
            />
          )}
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Report category" error={errors.category}>
            {(props) => (
              <Select {...props} value={values.category} onChange={set("category")} disabled={submitting}>
                <option value="">Choose a category</option>
                {REPORT_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reason for reporting" error={errors.reason}>
            {(props) => (
              <Select {...props} value={values.reason} onChange={set("reason")} disabled={submitting}>
                <option value="">Choose a reason</option>
                {REPORT_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          label="Description"
          error={errors.description}
          hint={`What happened, and what made the site look suspicious? Do not include passwords or card numbers. ${remaining.toLocaleString("en")} characters left.`}
        >
          {(props) => (
            <Textarea
              {...props}
              rows={6}
              maxLength={DESCRIPTION_MAX}
              placeholder="For example: I got a text saying my parcel was held, and the link asked for my card details."
              value={values.description}
              onChange={set("description")}
              disabled={submitting}
            />
          )}
        </Field>

        <Field label="Contact email" optional error={errors.contactEmail} hint="Only used if we need to ask a follow-up question about this report.">
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={values.contactEmail}
              onChange={set("contactEmail")}
              disabled={submitting}
            />
          )}
        </Field>

        {/* Honeypot: hidden from people and assistive tech, tempting for bots. */}
        <div className="absolute left-[-9999px] top-auto size-px overflow-hidden" aria-hidden="true">
          <label>
            Leave this field empty
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-sm items-start gap-2 text-[0.8125rem] text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            Reports are reviewed as signals. Submitting one does not publicly label a site.
          </p>
          <Button type="submit" size="lg" loading={submitting} className="shrink-0">
            {submitting ? (
              "Sending report"
            ) : (
              <>
                <Send className="size-4" strokeWidth={2} aria-hidden="true" />
                Submit report
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
