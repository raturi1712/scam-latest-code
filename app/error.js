"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function GlobalError({ reset }) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-16">
      <Card shadow="lg" className="w-full max-w-md px-7 py-10 text-center" role="alert">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger-fg">
          <TriangleAlert className="size-6" strokeWidth={1.9} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">Something went wrong</h1>
        <p className="mt-2 text-[0.9375rem] text-muted">This page hit a problem. Your data is safe. Try loading it again.</p>
        <div className="mt-7 flex justify-center">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </Card>
    </main>
  );
}
