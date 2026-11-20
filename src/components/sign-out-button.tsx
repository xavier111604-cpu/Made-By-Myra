"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className={className ?? "whitespace-nowrap rounded-xl px-3 py-2 text-left text-charcoal/60 hover:bg-cream"}>
      Sign out
    </button>
  );
}
