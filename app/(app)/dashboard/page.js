import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { PageLoader } from "@/components/ui/Feedback";

export const metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardView />
    </Suspense>
  );
}
