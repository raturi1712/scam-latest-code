import { Suspense } from "react";
import { SavedReport } from "@/components/scan/SavedReport";
import { PageLoader } from "@/components/ui/Feedback";

export const metadata = { title: "Scan report" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SavedReport />
    </Suspense>
  );
}
