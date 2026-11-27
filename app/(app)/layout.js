import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageLoader } from "@/components/ui/Feedback";

export const metadata = {
  robots: { index: false, follow: false },
};

function ShellFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <PageLoader label="Loading" />
    </div>
  );
}

export default function AppLayout({ children }) {
  // The shell reads the current path and auth state, both only known at request time,
  // so it streams in behind a Suspense boundary.
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
