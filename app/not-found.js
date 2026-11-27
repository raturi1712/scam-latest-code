import { SearchX } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconSquare } from "@/components/ui/IconSquare";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-canvas px-4 py-16">
      <Logo />
      <Card shadow="lg" className="w-full max-w-md px-7 py-10 text-center">
        <IconSquare icon={SearchX} size="lg" />
        <p className="mt-5 text-sm font-medium text-primary">Error 404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">Page not found</h1>
        <p className="mt-2 text-[0.9375rem] text-muted">That address does not exist here. Check the link, or head back and scan a website.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <ButtonLink href="/" variant="secondary">
            Go to homepage
          </ButtonLink>
          <ButtonLink href="/check">Scan a website</ButtonLink>
        </div>
      </Card>
    </main>
  );
}
