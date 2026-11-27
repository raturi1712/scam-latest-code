import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/AuthForms";
import { PageLoader } from "@/components/ui/Feedback";

export const metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RegisterForm />
    </Suspense>
  );
}
