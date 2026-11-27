import { Suspense } from "react";
import { LoginForm } from "@/components/auth/AuthForms";
import { PageLoader } from "@/components/ui/Feedback";

export const metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}
