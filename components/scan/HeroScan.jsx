"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { ScanForm } from "./ScanForm";

/** Landing-page scan box: sends the visitor to the right scanner with the URL prefilled. */
export function HeroScan() {
  const router = useRouter();
  const { account } = useAuth();

  return (
    <ScanForm
      size="lg"
      onScan={(url) => router.push(`${account ? "/scan" : "/check"}?url=${encodeURIComponent(url)}`)}
    />
  );
}
