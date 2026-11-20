"use client";

import { useState, useTransition } from "react";
import { FileDrop, type UploadedFile } from "./file-drop";
import { CONTACT_CATEGORIES } from "@/lib/labels";
import { submitContact } from "@/actions/contact";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", category: "general", subject: "", message: "", website: "" });
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  if (result?.ok) return <p className="card p-6 text-center" role="status"><span className="heading-script block text-3xl">Thank you!</span>{result.text}</p>;

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitContact({ ...form, uploadId: file?.id });
          setResult(res.ok ? { ok: true, text: "Your message is on its way. We'll reply by email soon." } : { ok: false, text: res.error });
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="label">Name</label>
          <input id="c-name" className="input" required maxLength={100} value={form.name} onChange={set("name")} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="c-email" className="label">Email</label>
          <input id="c-email" type="email" className="input" required maxLength={200} value={form.email} onChange={set("email")} autoComplete="email" />
        </div>
      </div>
      <div>
        <label htmlFor="c-cat" className="label">What is this about?</label>
        <select id="c-cat" className="input" value={form.category} onChange={set("category")}>
          {CONTACT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="c-subject" className="label">Subject</label>
        <input id="c-subject" className="input" required maxLength={150} value={form.subject} onChange={set("subject")} />
      </div>
      <div>
        <label htmlFor="c-msg" className="label">Message</label>
        <textarea id="c-msg" className="input min-h-36" required maxLength={5000} value={form.message} onChange={set("message")} />
      </div>
      {/* Honeypot for bots — hidden from people and screen readers */}
      <input type="text" name="website" value={form.website} onChange={set("website")} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <div>
        <p className="label">Attachment (optional)</p>
        {file ? (
          <p className="text-sm">{file.filename} <button type="button" className="underline" onClick={() => setFile(null)}>Remove</button></p>
        ) : (
          <FileDrop purpose="CONTACT" compact label="Attach a file" onUploaded={setFile} />
        )}
      </div>
      {result && !result.ok && <p className="text-sm text-red-700" role="alert">{result.text}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
    </form>
  );
}
