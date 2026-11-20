import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { googleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle="Save favorites, reorder in a tap, and follow your custom designs.">
      <Suspense>
        <RegisterForm googleEnabled={googleEnabled} />
      </Suspense>
    </AuthShell>
  );
}
