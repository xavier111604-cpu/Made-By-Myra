import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { limitByIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email().max(200), consent: z.literal(true), source: z.string().max(30).optional() });

/**
 * Stores subscribers (with consent timestamp) in the database. If RESEND_AUDIENCE_ID is set,
 * also adds the contact to that Resend Audience so you can send campaigns from Resend.
 */
export async function POST(req: Request) {
  if (!(await limitByIp("newsletter", 5, 60 * 60))) return NextResponse.json({ error: "Please try again later." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email and tick the consent box." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();

  const sub = await db.newsletterSubscriber.upsert({
    where: { email },
    update: { consentAt: new Date(), unsubscribedAt: null, source: parsed.data.source },
    create: { email, consentAt: new Date(), source: parsed.data.source },
  });

  if (process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID) {
    try {
      const res = await fetch(`https://api.resend.com/audiences/${process.env.RESEND_AUDIENCE_ID}/contacts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, unsubscribed: false }),
      });
      if (res.ok) await db.newsletterSubscriber.update({ where: { id: sub.id }, data: { syncedAt: new Date() } });
      else console.error("Resend audience sync failed", res.status, await res.text());
    } catch (err) {
      console.error("Resend audience sync error", err);
    }
  }
  return NextResponse.json({ ok: true });
}
