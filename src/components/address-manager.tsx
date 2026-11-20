"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/actions/account";

type Addr = { id: string; name: string; line1: string; line2: string | null; city: string; state: string; postalCode: string; country: string; phone: string | null; isDefault: boolean };

const EMPTY = { name: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "US", phone: "", isDefault: false };

export function AddressManager({ addresses }: { addresses: Addr[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(addresses.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setError(r.ok ? null : (r.error ?? "Error")); router.refresh(); });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="card p-4 text-sm">
            {a.isDefault && <span className="chip mb-2 border-gold text-gold">Default</span>}
            <p className="font-medium">{a.name}</p>
            <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
            <p>{a.city}, {a.state} {a.postalCode} · {a.country}</p>
            {a.phone && <p>{a.phone}</p>}
            <div className="mt-3 flex gap-3 text-xs">
              {!a.isDefault && <button className="underline" onClick={() => act(() => setDefaultAddress(a.id))}>Make default</button>}
              <button className="text-charcoal/60 underline" onClick={() => act(() => deleteAddress(a.id))}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {open ? (
        <form
          className="card grid gap-3 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveAddress({ ...form, line2: form.line2 || undefined, phone: form.phone || undefined });
              if (r.ok) { setForm(EMPTY); setOpen(false); setError(null); router.refresh(); } else setError(r.error);
            });
          }}
        >
          {([
            ["name", "Full name", true],
            ["phone", "Phone (optional)", false],
            ["line1", "Address line 1", true],
            ["line2", "Address line 2 (optional)", false],
            ["city", "City", true],
            ["state", "State / region", true],
            ["postalCode", "ZIP / postal code", true],
            ["country", "Country code (e.g. US)", true],
          ] as const).map(([k, label, req]) => (
            <div key={k}>
              <label htmlFor={`a-${k}`} className="label">{label}</label>
              <input id={`a-${k}`} className="input" required={req} value={form[k] as string} onChange={f(k)} maxLength={k === "country" ? 2 : 200} />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isDefault} onChange={f("isDefault")} className="accent-[#E8B5C0]" /> Make this my default address</label>
          {error && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary btn-sm" disabled={pending}>Save address</button>
            {addresses.length > 0 && <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>}
          </div>
        </form>
      ) : (
        <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}>Add an address</button>
      )}
    </div>
  );
}
