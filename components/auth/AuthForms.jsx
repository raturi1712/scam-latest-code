"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, MailCheck, Settings2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Field";
import {
  authErrorMessage,
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/services/auth-service";
import { validateDisplayName, validateEmail, validatePassword } from "@/lib/utils/validation";
import { useAuth } from "./AuthProvider";

/** Only allow same-site relative redirects after sign-in (prevents open redirects). */
function safeNext(value) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/dashboard";
}

function useRedirectWhenSignedIn() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const next = safeNext(params.get("next"));
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);
  return next;
}

function PreviewNotice() {
  const { preview } = useAuth();
  if (!preview) return null;
  const steps = [
    "Create a Firebase project and enable Email/Password and Google sign-in.",
    <>
      Copy <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-fg">.env.example</code> to{" "}
      <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-fg">.env.local</code> and fill in the values.
    </>,
    "Restart the app. Sign-in turns on automatically.",
  ];
  return (
    <div className="mb-6 rounded-2xl border border-warning/30 bg-warning-soft p-5" role="status">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-warning-fg ring-1 ring-warning/25">
          <Settings2 className="size-4" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">Sign-in setup: Firebase is not connected yet</p>
          <p className="mt-0.5 text-sm text-muted">Until then you can explore the app with scan history stored in this browser.</p>
        </div>
      </div>
      <ol className="mt-4 space-y-2.5 border-t border-warning/20 pt-4">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3 text-sm text-fg/90">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-[0.6875rem] font-semibold text-warning-fg ring-1 ring-warning/25">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <ButtonLink href="/dashboard" size="sm" variant="secondary" className="mt-4">
        Open the dashboard in preview mode
        <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
      </ButtonLink>
    </div>
  );
}

function AuthHeading({ title, text }) {
  return (
    <div className="mb-7">
      <h1 className="text-[1.75rem] font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">{text}</p>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-medium text-subtle">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[1.125rem]" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

function GoogleButton({ onError, disabled, label }) {
  const [busy, setBusy] = useState(false);
  async function handleClick() {
    onError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      onError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" size="lg" className="w-full" onClick={handleClick} loading={busy} disabled={disabled}>
      {busy ? null : <GoogleMark />}
      {label}
    </Button>
  );
}

function PasswordInput({ value, onChange, autoComplete, disabled, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" strokeWidth={2} aria-hidden="true" /> : <Eye className="size-4" strokeWidth={2} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function LoginForm() {
  useRedirectWhenSignedIn();
  const { preview } = useAuth();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    const problems = {
      email: validateEmail(values.email),
      password: values.password ? null : "Enter your password.",
    };
    setErrors(problems);
    if (problems.email || problems.password) return;

    setBusy(true);
    try {
      await signInWithEmail(values);
    } catch (error) {
      setFormError(authErrorMessage(error));
      setBusy(false);
    }
  }

  return (
    <>
      <AuthHeading title="Welcome back" text="Sign in to see your scan history and saved reports." />
      <PreviewNotice />
      <Card shadow="lg" className="px-5 py-6 sm:px-7 sm:py-7">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field label="Email" error={errors.email}>
            {(props) => (
              <Input {...props} type="email" autoComplete="email" value={values.email} onChange={set("email")} disabled={busy || preview} />
            )}
          </Field>
          <Field label="Password" error={errors.password}>
            {(props) => (
              <PasswordInput {...props} autoComplete="current-password" value={values.password} onChange={set("password")} disabled={busy || preview} />
            )}
          </Field>
          <div className="-mt-3 text-right">
            <Link href="/forgot-password" className="text-sm font-medium text-primary-ink hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" loading={busy} disabled={preview} className="w-full">
            Sign in
          </Button>
          <Divider />
          <GoogleButton onError={setFormError} disabled={busy || preview} label="Continue with Google" />
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        New to ScamShield AI?{" "}
        <Link href="/register" className="font-medium text-primary-ink hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export function RegisterForm() {
  useRedirectWhenSignedIn();
  const { preview } = useAuth();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    const problems = {
      name: validateDisplayName(values.name),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
      confirm: values.confirm === values.password ? null : "The passwords do not match.",
    };
    setErrors(problems);
    if (Object.values(problems).some(Boolean)) return;

    setBusy(true);
    try {
      await signUpWithEmail(values);
    } catch (error) {
      setFormError(authErrorMessage(error));
      setBusy(false);
    }
  }

  const off = busy || preview;

  return (
    <>
      <AuthHeading title="Create account" text="Free. Save every scan and rescan sites with one click." />
      <PreviewNotice />
      <Card shadow="lg" className="px-5 py-6 sm:px-7 sm:py-7">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field label="Name" error={errors.name}>
            {(props) => <Input {...props} type="text" autoComplete="name" value={values.name} onChange={set("name")} disabled={off} />}
          </Field>
          <Field label="Email" error={errors.email}>
            {(props) => <Input {...props} type="email" autoComplete="email" value={values.email} onChange={set("email")} disabled={off} />}
          </Field>
          <Field label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
            {(props) => <PasswordInput {...props} autoComplete="new-password" value={values.password} onChange={set("password")} disabled={off} />}
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            {(props) => <PasswordInput {...props} autoComplete="new-password" value={values.confirm} onChange={set("confirm")} disabled={off} />}
          </Field>
          <Button type="submit" size="lg" loading={busy} disabled={preview} className="w-full">
            Create account
          </Button>
          <Divider />
          <GoogleButton onError={setFormError} disabled={off} label="Sign up with Google" />
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary-ink hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  const { preview } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    const problem = validateEmail(email);
    setError(problem);
    if (problem) return;

    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSentTo(email.trim());
    } catch (failure) {
      // Do not reveal whether an account exists for this address.
      if (failure?.code === "auth/user-not-found") setSentTo(email.trim());
      else setFormError(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <Card shadow="lg" className="fade-up px-6 py-8 sm:px-8" role="status">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-success-soft text-success-fg">
          <MailCheck className="size-6" strokeWidth={1.9} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">Check your inbox</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          If an account exists for <strong className="break-all font-semibold text-fg">{sentTo}</strong>, a password reset link is on its way.
          It can take a few minutes, and may land in spam.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <ButtonLink href="/login">Back to sign in</ButtonLink>
          <Button variant="secondary" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <AuthHeading title="Reset password" text="Enter your account email and we will send you a reset link." />
      <PreviewNotice />
      <Card shadow="lg" className="px-5 py-6 sm:px-7 sm:py-7">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field label="Email" error={error}>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy || preview}
              />
            )}
          </Field>
          <Button type="submit" size="lg" loading={busy} disabled={preview} className="w-full">
            Send reset link
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary-ink hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
