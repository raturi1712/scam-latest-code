"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarDays, Database, History, KeyRound, LogIn, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Field";
import { IconSquare } from "@/components/ui/IconSquare";
import { PageHeading } from "@/components/ui/PageHeading";
import { useToast } from "@/components/ui/Toast";
import {
  authErrorMessage,
  changePassword,
  requestPasswordReset,
  signOut,
  updateDisplayName,
} from "@/lib/services/auth-service";
import { computeStats } from "@/lib/services/scan-service";
import { useScans } from "@/lib/services/use-scans";
import { formatDate } from "@/lib/utils/format";
import { validateDisplayName, validatePassword } from "@/lib/utils/validation";

const PROVIDER_LABELS = { password: "Email and password", "google.com": "Google" };

function ProfileDetailsForm({ account, disabled }) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [name, setName] = useState(account.displayName);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const unchanged = name.trim() === account.displayName;

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validateDisplayName(name);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      refreshUser(await updateDisplayName(name));
      toast.success("Your profile has been updated.");
    } catch (failure) {
      toast.error(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 px-5 py-5 sm:px-6">
      <Field label="Display name" error={error} hint="Shown in the sidebar and on your dashboard.">
        {(props) => (
          <Input {...props} type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} disabled={disabled || busy} />
        )}
      </Field>
      <Field label="Email" hint="Your sign-in email cannot be changed here.">
        {(props) => <Input {...props} type="email" value={account.email || "Not available in preview mode"} readOnly disabled />}
      </Field>
      <div className="flex justify-end border-t border-line pt-5">
        <Button type="submit" loading={busy} disabled={disabled || unchanged}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ account }) {
  const toast = useToast();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    const problems = {
      current: values.current ? null : "Enter your current password.",
      next: validatePassword(values.next) || (values.next === values.current ? "Choose a password different from the current one." : null),
      confirm: values.confirm === values.next ? null : "The passwords do not match.",
    };
    setErrors(problems);
    if (Object.values(problems).some(Boolean)) return;

    setBusy(true);
    try {
      await changePassword({ currentPassword: values.current, newPassword: values.next });
      setValues({ current: "", next: "", confirm: "" });
      toast.success("Your password has been changed.");
    } catch (failure) {
      if (failure?.code === "auth/invalid-credential" || failure?.code === "auth/wrong-password") {
        setErrors({ current: "That is not your current password." });
      } else {
        toast.error(authErrorMessage(failure));
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setSendingReset(true);
    try {
      await requestPasswordReset(account.email);
      toast.success(`Password reset link sent to ${account.email}.`);
    } catch (failure) {
      toast.error(authErrorMessage(failure));
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 px-5 py-5 sm:px-6">
      <Field label="Current password" error={errors.current}>
        {(props) => <Input {...props} type="password" autoComplete="current-password" value={values.current} onChange={set("current")} disabled={busy} />}
      </Field>
      <Field label="New password" error={errors.next} hint="At least 8 characters, with a letter and a number.">
        {(props) => <Input {...props} type="password" autoComplete="new-password" value={values.next} onChange={set("next")} disabled={busy} />}
      </Field>
      <Field label="Confirm new password" error={errors.confirm}>
        {(props) => <Input {...props} type="password" autoComplete="new-password" value={values.confirm} onChange={set("confirm")} disabled={busy} />}
      </Field>
      <div className="flex flex-wrap justify-end gap-2.5 border-t border-line pt-5">
        <Button variant="ghost" onClick={sendReset} loading={sendingReset}>
          Email me a reset link instead
        </Button>
        <Button type="submit" loading={busy}>
          Change password
        </Button>
      </div>
    </form>
  );
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function ProfileView() {
  const router = useRouter();
  const toast = useToast();
  const { account, preview } = useAuth();
  const { scans, loading } = useScans();
  const stats = computeStats(scans);
  const [signingOut, setSigningOut] = useState(false);
  const hasPassword = account.providers.includes("password");

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      toast.success("You have been signed out.");
      router.replace("/");
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const facts = [
    { icon: KeyRound, label: "Sign-in method", value: preview ? "None (preview mode)" : account.providers.map((id) => PROVIDER_LABELS[id] || id).join(", ") },
    { icon: CalendarDays, label: "Member since", value: account.createdAt ? formatDate(account.createdAt) : "Not available" },
    { icon: LogIn, label: "Last sign-in", value: account.lastSignInAt ? formatDate(account.lastSignInAt) : "Not available" },
    { icon: History, label: "Scans saved", value: loading ? "Loading" : String(stats.total) },
  ];

  return (
    <>
      <PageHeading title="Profile" description="View your account details and manage your settings." />

      {preview ? (
        <Alert tone="info" title="Preview mode" className="mb-6">
          Account settings become editable once Firebase is connected. See <code className="font-mono text-fg">.env.example</code> for the
          values to add.
        </Alert>
      ) : null}

      {/* Identity */}
      <Card as="section" aria-labelledby="account-heading" className="mb-6 overflow-hidden">
        <div
          className="h-24 border-b border-line sm:h-28"
          style={{
            background:
              "radial-gradient(80% 140% at 0% 0%, rgb(59 130 246 / 0.35), transparent 60%), radial-gradient(60% 120% at 100% 100%, rgb(34 211 238 / 0.18), transparent 60%), var(--ss-surface-2)",
          }}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-5 px-5 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
            <span
              className="-mt-10 inline-flex size-20 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#3b82f6] to-[#06b6d4] text-2xl font-semibold text-white ring-4 ring-surface sm:-mt-12"
              aria-hidden="true"
            >
              {initials(account.displayName)}
            </span>
            <div className="min-w-0 pb-0.5">
              <h2 id="account-heading" className="break-words text-xl font-semibold text-fg">
                {account.displayName}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
                <span className="break-all">{account.email || "No email (preview mode)"}</span>
                {preview ? (
                  <Badge tone="warning">Preview</Badge>
                ) : account.emailVerified ? (
                  <Badge tone="success">
                    <BadgeCheck className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                    Email verified
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    <Mail className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                    Email not verified
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="secondary" onClick={handleSignOut} loading={signingOut} disabled={preview} className="self-start sm:self-auto">
            {signingOut ? null : <LogOut className="size-4" strokeWidth={2} aria-hidden="true" />}
            Log out
          </Button>
        </div>
        <dl className="grid grid-cols-1 divide-y divide-line border-t border-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-start gap-3 px-5 py-4 sm:px-7">
              <fact.icon className="mt-0.5 size-4 shrink-0 text-subtle" strokeWidth={1.9} aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-subtle">{fact.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-fg">{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card as="section" aria-labelledby="details-heading">
            <CardHeader
              title={<span id="details-heading">Profile details</span>}
              description="How you appear across ScamShield."
              action={<IconSquare icon={UserRound} size="sm" />}
            />
            <ProfileDetailsForm key={account.displayName} account={account} disabled={preview} />
          </Card>

          <Card as="section" id="security" aria-labelledby="security-heading" className="scroll-mt-24">
            <CardHeader
              title={<span id="security-heading">Password and security</span>}
              description="Keep your account protected."
              action={<IconSquare icon={KeyRound} size="sm" />}
            />
            {preview ? (
              <p className="px-5 py-5 text-sm text-muted sm:px-6">Password settings are available after Firebase is connected.</p>
            ) : hasPassword ? (
              <PasswordForm account={account} />
            ) : (
              <p className="px-5 py-5 text-sm text-muted sm:px-6">
                You sign in with Google, so there is no ScamShield password to manage. Your account security is handled in your
                Google account settings.
              </p>
            )}
          </Card>
        </div>

        <aside>
          <Card as="section" aria-labelledby="data-heading">
            <CardHeader title={<span id="data-heading">Data and privacy</span>} action={<IconSquare icon={Database} size="sm" />} />
            <div className="space-y-4 px-5 py-5 text-sm sm:px-6">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-fg" strokeWidth={2} aria-hidden="true" />
                <p className="text-muted">
                  <span className="font-medium text-fg">Where your scans are kept. </span>
                  {preview
                    ? "In preview mode, scan history is stored only in this browser and is not synced anywhere."
                    : "Scan reports are saved to your account so you can reopen them on any device."}
                </p>
              </div>
              <div className="flex gap-3">
                <History className="mt-0.5 size-4 shrink-0 text-primary-ink" strokeWidth={2} aria-hidden="true" />
                <p className="text-muted">
                  <span className="font-medium text-fg">Manage your records. </span>
                  Delete any scan you no longer need from{" "}
                  <Link href="/history" className="font-medium text-primary-ink hover:underline">
                    Scan history
                  </Link>
                  .
                </p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
