import { Suspense } from "react";
import { ArrowUpRight, Banknote, KeyRound, ShieldAlert } from "lucide-react";
import { ReportForm } from "@/components/report/ReportForm";
import { Card } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Feedback";
import { IconSquare } from "@/components/ui/IconSquare";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata = {
  title: "Report a suspicious website",
  description: "Tell us about a website you believe is a scam. Open to everyone, no account required.",
};

const URGENT = [
  { icon: Banknote, title: "You paid or shared card details", text: "Call your bank or card issuer now and ask them to block the payment and the card." },
  { icon: KeyRound, title: "You entered a password", text: "Change it on the real service immediately, and anywhere else you reuse it. Turn on two-factor authentication." },
  { icon: ShieldAlert, title: "Report it officially too", text: "File a report with your national fraud authority, such as the FTC, FBI IC3, Action Fraud or cybercrime.gov.in." },
];

const AUTHORITIES = [
  { href: "https://reportfraud.ftc.gov/", label: "FTC ReportFraud (US)" },
  { href: "https://www.ic3.gov/", label: "FBI IC3 (US)" },
  { href: "https://cybercrime.gov.in/", label: "Cybercrime Portal (India)" },
];

export default function ReportWebsitePage() {
  return (
    <div className="mx-auto max-w-(--ss-content-max) px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <PageHeading
        eyebrow="Open to everyone"
        title="Report a suspicious website"
        description="Seen a site that looks like a scam? Send us the details. It takes about a minute and you do not need an account."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8">
        <Suspense fallback={<PageLoader label="Loading form" />}>
          <ReportForm />
        </Suspense>
        <aside aria-labelledby="urgent-heading" className="space-y-6 lg:sticky lg:top-24">
          <Card>
            <div className="border-b border-line px-5 py-5">
              <h2 id="urgent-heading" className="text-base font-semibold text-fg">
                Already affected?
              </h2>
              <p className="mt-0.5 text-sm text-muted">A report here does not replace these steps.</p>
            </div>
            <ul className="divide-y divide-line">
              {URGENT.map((item) => (
                <li key={item.title} className="flex gap-3.5 px-5 py-4">
                  <IconSquare icon={item.icon} size="sm" tone="warning" />
                  <div>
                    <h3 className="text-sm font-semibold text-fg">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card tone="subtle" className="px-5 py-5">
            <h2 className="text-sm font-semibold text-fg">Official fraud authorities</h2>
            <ul className="mt-3 space-y-2">
              {AUTHORITIES.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline"
                  >
                    {link.label}
                    <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
