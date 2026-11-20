import "server-only";
import { siteUrl } from "./utils";

/**
 * Transactional email via Resend's HTTP API (https://resend.com). If RESEND_API_KEY is not set,
 * emails are logged to the server console instead of sent, so local development still works.
 */
export const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export function ownerEmail() {
  return process.env.OWNER_NOTIFICATION_EMAIL || "";
}

export async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }) {
  if (!opts.to) return { ok: false, skipped: true };
  if (!emailConfigured) {
    console.info(`[email:not-configured] to=${opts.to} subject="${opts.subject}"`);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        reply_to: opts.replyTo || process.env.EMAIL_REPLY_TO || undefined,
      }),
    });
    if (!res.ok) console.error("Resend error", res.status, await res.text());
    return { ok: res.ok };
  } catch (err) {
    console.error("sendEmail failed", err);
    return { ok: false };
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Simple branded email layout. `body` is trusted HTML built by the templates below. */
export function layout(heading: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#FFF9F8;font-family:Helvetica,Arial,sans-serif;color:#302A29">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-family:'Brush Script MT',cursive;font-size:30px;margin:0 0 16px">Made by Myra <span style="color:#E8B5C0">♡</span></p>
    <div style="background:#fff;border:1px solid #EFE5E3;border-radius:16px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
      <div style="font-size:15px;line-height:1.6">${body}</div>
      ${cta ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="background:#F6DCE0;color:#302A29;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>` : ""}
    </div>
    <p style="font-size:12px;color:#8a7f7d;margin-top:20px">Made with love, just for you ♡ · <a href="${siteUrl()}" style="color:#BB9255">${esc(siteUrl().replace(/^https?:\/\//, ""))}</a></p>
  </div></body></html>`;
}

export const emailText = esc;
