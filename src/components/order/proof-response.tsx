"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToProof } from "@/actions/orders";
import { formatMoney } from "@/lib/format";

export function ProofResponse({ orderId, token, proofId, revisionsLeft, extraFeeCents }: { orderId: string; token?: string; proofId: string; revisionsLeft: number; extraFeeCents: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "revise">("idle");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res = await respondToProof({ orderId, token, proofId, approve, comment: comment || undefined });
      if (!res.ok) return setError(res.error);
      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
        return;
      }
      router.refresh();
    });

  return (
    <div className="mt-4 space-y-3">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary btn-sm" disabled={pending} onClick={() => send(true)}>
            {pending ? "Saving…" : "Approve this design ♡"}
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setMode("revise")}>Request changes</button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`rev-${proofId}`} className="label">What would you like changed?</label>
          <textarea id={`rev-${proofId}`} className="input min-h-24" maxLength={1500} value={comment} onChange={(e) => setComment(e.target.value)} />
          <p className="text-xs text-charcoal/60">
            {revisionsLeft > 0
              ? `${revisionsLeft} included revision${revisionsLeft === 1 ? "" : "s"} remaining.`
              : extraFeeCents > 0
                ? `You've used your included revisions. Additional revisions are ${formatMoney(extraFeeCents)} — you'll be taken to secure payment.`
                : "You've used your included revisions, but we're happy to keep refining."}
          </p>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" disabled={pending} onClick={() => send(false)}>{pending ? "Sending…" : "Send revision request"}</button>
            <button className="btn-ghost btn-sm" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </div>
      )}
      <p className="text-xs text-charcoal/60">Production begins after you approve your design.</p>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
