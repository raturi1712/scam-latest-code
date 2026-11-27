import { Suspense } from "react";
import { PublicScanner } from "@/components/scan/PublicScanner";
import { PageLoader } from "@/components/ui/Feedback";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata = {
  title: "Scan a website",
  description: "Check any website for scam and phishing indicators and get an explained risk score.",
};

export default function CheckPage() {
  return (
    <div className="print-full mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <PageHeading
        eyebrow="Website scanner"
        title="Scan a website"
        description="Enter a link or domain. The scan runs on our server, so you never have to open the site yourself."
      />
      <Suspense fallback={<PageLoader label="Loading scanner" />}>
        <PublicScanner />
      </Suspense>
    </div>
  );
}
