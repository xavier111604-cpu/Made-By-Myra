"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDrop, type UploadedFile } from "../file-drop";
import { postCustomerMessage } from "@/actions/orders";
import { postOwnerMessage } from "@/actions/admin-orders";
import { cn, formatDateTime } from "@/lib/format";

type Msg = { id: string; author: "CUSTOMER" | "OWNER"; body: string; createdAt: string; fileUrl: string | null };

export function MessageThread({ orderId, token, messages, asOwner = false }: { orderId: string; token?: string; messages: Msg[]; asOwner?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mine = asOwner ? "OWNER" : "CUSTOMER";

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">{asOwner ? "Messages with customer" : "Messages"}</h2>
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-charcoal/60">{asOwner ? "No messages yet." : "Have a question about your order? Send us a message."}</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.author === mine ? "ml-auto bg-blush/60" : "bg-cream")}>
            <p className="whitespace-pre-line">{m.body}</p>
            {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs underline">View attachment</a>}
            <p className="mt-1 text-[10px] text-charcoal/50">{m.author === "OWNER" ? "Made by Myra" : "Customer"} · {formatDateTime(m.createdAt)}</p>
          </div>
        ))}
      </div>
      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = asOwner
              ? await postOwnerMessage({ orderId, body, uploadId: file?.id })
              : await postCustomerMessage({ orderId, token, body, uploadId: file?.id });
            if (res.ok) {
              setBody("");
              setFile(null);
              setError(null);
              router.refresh();
            } else setError(res.error);
          });
        }}
      >
        <label htmlFor={`msg-${orderId}`} className="sr-only">Message</label>
        <textarea id={`msg-${orderId}`} className="input min-h-20" maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" required />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary btn-sm" disabled={pending || !body.trim()}>{pending ? "Sending…" : "Send"}</button>
          {file ? (
            <span className="text-xs">{file.filename} <button type="button" className="underline" onClick={() => setFile(null)}>remove</button></span>
          ) : (
            <details className="text-xs">
              <summary className="cursor-pointer text-charcoal/60">Attach a file</summary>
              <div className="mt-2 w-72"><FileDrop purpose={asOwner ? "PROOF" : "MESSAGE"} compact label="Attach" onUploaded={setFile} /></div>
            </details>
          )}
        </div>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </form>
    </div>
  );
}
