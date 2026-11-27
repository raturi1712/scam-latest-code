import { Suspense } from "react";
import { AppScanner } from "@/components/scan/AppScanner";
import { PageLoader } from "@/components/ui/Feedback";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata = { title: "Scan a website" };

export default function Page() {
  return (
    <>
      <PageHeading
        title="Scan a website"
        description="Paste a link or domain to run live security checks. Every result is saved to your scan history."
      />
      <Suspense fallback={<PageLoader label="Loading scanner" />}>
        <AppScanner />
      </Suspense>
    </>
  );
}
