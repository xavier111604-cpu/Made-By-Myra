"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDrop, type UploadedFile } from "../file-drop";
import { issueRefund, uploadProof } from "@/actions/admin-orders";
import { formatMoney } from "@/lib/format";

export function ProofUploader({ orderItemId }: { orderItemId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 rounded-xl bg-cream p-3">
      <p className="text-sm font-medium">Upload a new proof</p>
      {file ? <p className="text-sm">{file.filename} <button className="underline" onClick={() => setFile(null)}>change</button></p> : <FileDrop purpose="PROOF" compact label="Choose proof file" onUploaded={setFile} />}
      <textarea className="input min-h-16" placeholder="Note to the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} aria-label="Note to customer" />
      <button
        className="btn-primary btn-sm"
        disabled={!file || pending}
        onClick={() =>
          start(async () => {
            const res = await uploadProof({ orderItemId, uploadId: file!.id, note: note || undefined });
            if (res.ok) {
              setFile(null);
              setNote("");
              setMsg("Proof sent — the customer has been emailed.");
              router.refresh();
            } else setMsg(res.error);
          })
        }
      >
        {pending ? "Sending…" : "Send proof to customer"}
      </button>
      {msg && <p className="text-xs" role="status">{msg}</p>}
    </div>
  );
}

export function RefundForm({ orderId, paymentId, maxCents }: { orderId: string; paymentId: string; maxCents: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState((maxCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Refund amount in dollars" />
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" aria-label="Refund reason" />
      </div>
      {!confirm ? (
        <button className="btn-secondary btn-sm" onClick={() => setConfirm(true)}>Refund…</button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            className="btn-dark btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await issueRefund({ orderId, paymentId, amount, reason: reason || undefined });
                setMsg(res.ok ? "Refund sent to Stripe. Status updates when Stripe confirms." : res.error);
                setConfirm(false);
                router.refresh();
              })
            }
          >
            {pending ? "Refunding…" : `Confirm refund of $${amount}`}
          </button>
          <button className="text-xs underline" onClick={() => setConfirm(false)}>cancel</button>
        </div>
      )}
      <p className="text-[11px] text-charcoal/60">Up to {formatMoney(maxCents)}. Refunds go back to the original payment method.</p>
      {msg && <p className="text-xs" role="status">{msg}</p>}
    </div>
  );
}
