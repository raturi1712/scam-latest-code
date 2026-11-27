import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { PageLoader } from "@/components/ui/Feedback";

export const metadata = { title: "Reset password" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
