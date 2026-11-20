"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/format";

export function NewsletterForm({ compact = false, source = "home" }: { compact?: boolean; source?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setState("error");
      setMsg("Please tick the box to agree to receive emails.");
      return;
    }
    setState("loading");
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, consent, source }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setState("done");
      setMsg("Thank you! You're on the list ♡");
    } else {
      setState("error");
      setMsg(data.error || "Something went wrong. Please try again.");
    }
  }

  if (state === "done") return <p className="text-sm font-medium text-charcoal" role="status">{msg}</p>;

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className={cn("flex gap-2", !compact && "flex-col sm:flex-row")}>
        <label htmlFor={`nl-${source}`} className="sr-only">Email address</label>
        <input
          id={`nl-${source}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className="input"
          autoComplete="email"
        />
        <button className={cn("btn-primary shrink-0", compact && "px-4")} disabled={state === "loading"}>
          {state === "loading" ? "Joining…" : "Subscribe"}
        </button>
      </div>
      <label className="flex items-start gap-2 text-xs text-charcoal/70">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#E8B5C0]" />
        <span>
          Yes, email me about new products, updates and promotions. I can unsubscribe at any time. See our{" "}
         <Link href="/policies/privacy" className="underline">privacy policy</Link>.
        </span>
      </label>
      {state === "error" && <p className="text-xs text-red-700" role="alert">{msg}</p>}
    </form>
  );
}
