"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { limitByIp } from "@/lib/rate-limit";
import { findCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import { layout, ownerEmail, sendEmail, emailText as esc } from "@/lib/email";
import { siteUrl } from "@/lib/utils";
import { CONTACT_CATEGORIES } from "@/lib/labels";
import type { ActionResult } from "./cart";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100),
  email: z.string().trim().email("Please enter a valid email.").max(200),
  category: z.enum(CONTACT_CATEGORIES.map((c) => c.value) as [string, ...string[]]),
  subject: z.string().trim().min(1, "Please add a subject.").max(150),
  message: z.string().trim().min(5, "Please write a message.").max(5000),
  website: z.string().max(0).optional(), // honeypot must be empty
  uploadId: z.string().max(40).optional(),
});

export async function submitContact(input: z.input<typeof schema>): Promise<ActionResult> {
  if (!(await limitByIp("contact", 5, 60 * 60))) return { ok: false, error: "Too many messages. Please try again later." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  let uploadId: string | undefined;
  if (d.uploadId) {
    const [up, cart, user] = await Promise.all([db.upload.findUnique({ where: { id: d.uploadId } }), findCart(), getCurrentUser()]);
    if (up && up.status === "READY" && up.purpose === "CONTACT" && ((cart && up.cartId === cart.id) || (user && up.userId === user.id))) uploadId = up.id;
  }

  const msg = await db.contactMessage.create({
    data: { name: d.name, email: d.email.toLowerCase(), category: d.category, subject: d.subject, message: d.message, uploadId },
  });
  const cat = CONTACT_CATEGORIES.find((c) => c.value === d.category)?.label;
  await sendEmail({
    to: ownerEmail(),
    replyTo: d.email,
    subject: `[${cat}] ${d.subject}`,
    html: layout(
      `New message from ${d.name}`,
      `<p><strong>${esc(d.name)}</strong> &lt;${esc(d.email)}&gt;</p><p style="white-space:pre-wrap">${esc(d.message)}</p>${uploadId ? "<p>Includes an attachment (view it in the dashboard).</p>" : ""}`,
      { label: "Open in dashboard", url: siteUrl(`/admin/requests#msg-${msg.id}`) },
    ),
  });
  return { ok: true };
}
