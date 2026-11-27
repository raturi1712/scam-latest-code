import { Suspense } from "react";
import { HistoryView } from "@/components/scan/HistoryView";
import { PageLoader } from "@/components/ui/Feedback";

export const metadata = { title: "Scan history" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <HistoryView />
    </Suspense>
  );
}
