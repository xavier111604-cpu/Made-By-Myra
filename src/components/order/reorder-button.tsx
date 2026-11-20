"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reorder } from "@/actions/orders";
import { openCartDrawer } from "../site-header";

export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="text-right">
      <button
        className="btn-secondary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await reorder(orderId);
            if (!res.ok) return setMsg(res.error);
            const { added, skipped } = res.data ?? { added: 0, skipped: 0 };
            setMsg(skipped ? `${added} item(s) added. ${skipped} couldn't be re-added (custom designs or unavailable items) — message us to reorder those.` : null);
            router.refresh();
            if (added) openCartDrawer();
          })
        }
      >
        {pending ? "Adding…" : "Reorder"}
      </button>
      {msg && <p className="mt-1 max-w-xs text-xs text-charcoal/70">{msg}</p>}
    </div>
  );
}
