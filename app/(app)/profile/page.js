import { Suspense } from "react";
import { ProfileView } from "@/components/profile/ProfileView";
import { PageLoader } from "@/components/ui/Feedback";

export const metadata = { title: "Profile" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProfileView />
    </Suspense>
  );
}
