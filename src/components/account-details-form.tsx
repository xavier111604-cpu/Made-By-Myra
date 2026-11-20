"use client";

import { useState, useTransition } from "react";
import { changePassword, updateProfile } from "@/actions/account";

export function AccountDetailsForm({ name, email, hasPassword }: { name: string; email: string; hasPassword: boolean }) {
  const [n, setN] = useState(name);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-8">
      <form className="card space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateProfile({ name: n }); setMsg(r.ok ? { ok: true, text: "Saved ♡" } : { ok: false, text: r.error }); }); }}>
        <div>
          <label htmlFor="d-name" className="label">Name</label>
          <input id="d-name" className="input" value={n} onChange={(e) => setN(e.target.value)} maxLength={100} required />
        </div>
        <div>
          <p className="label">Email</p>
          <p className="text-sm text-charcoal/70">{email}</p>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{msg.text}</p>}
        <button className="btn-primary btn-sm" disabled={pending}>Save</button>
      </form>

      <form className="card space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await changePassword(pw); setPwMsg(r.ok ? { ok: true, text: "Password updated." } : { ok: false, text: r.error }); if (r.ok) setPw({ current: "", next: "" }); }); }}>
        <h3 className="font-semibold">{hasPassword ? "Change password" : "Set a password"}</h3>
        {hasPassword && (
          <div>
            <label htmlFor="d-cur" className="label">Current password</label>
            <input id="d-cur" type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </div>
        )}
        <div>
          <label htmlFor="d-new" className="label">New password</label>
          <input id="d-new" type="password" className="input" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
        </div>
        {pwMsg && <p className={`text-sm ${pwMsg.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{pwMsg.text}</p>}
        <button className="btn-primary btn-sm" disabled={pending}>Update password</button>
      </form>
    </div>
  );
}
