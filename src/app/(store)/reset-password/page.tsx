import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ResetPage() {
  return (
    <AuthShell title="Choose a new password">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
