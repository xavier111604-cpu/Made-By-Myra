"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordSchema } from "@/lib/auth";
import { limitByIp } from "@/lib/rate-limit";
import { randomToken, sha256, siteUrl } from "@/lib/utils";
import { layout, sendEmail } from "@/lib/email";
import type { ActionResult } from "./cart";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100),
  email: z.string().trim().email("Please enter a valid email.").max(200),
  password: passwordSchema,
});

export async function registerUser(input: z.input<typeof registerSchema>): Promise<ActionResult> {
  if (!(await limitByIp("register", 5, 60 * 60))) return { ok: false, error: "Too many attempts. Please try again later." };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return { ok: false, error: "An account with this email already exists. Try signing in or resetting your password." };
  const passwordHash = await hashPassword(parsed.data.password);
  if (existing) {
    // Account created earlier via Google — let them add a password
    await db.user.update({ where: { id: existing.id }, data: { passwordHash, name: existing.name ?? parsed.data.name } });
  } else {
    await db.user.create({ data: { email, name: parsed.data.name, passwordHash } });
  }
  // Note: past guest orders are intentionally NOT auto-linked by email, because the email address
  // isn't verified at sign-up. Guests keep access through the secure link in their order email.
  return { ok: true };
}

export async function requestPasswordReset(emailRaw: string): Promise<ActionResult> {
  if (!(await limitByIp("pwreset", 5, 60 * 60))) return { ok: false, error: "Too many requests. Please try again later." };
  const email = z.string().trim().email().max(200).safeParse(emailRaw);
  if (!email.success) return { ok: false, error: "Please enter a valid email." };
  const user = await db.user.findUnique({ where: { email: email.data.toLowerCase() } });
  // Always respond the same way so we don't reveal which emails have accounts
  if (user) {
    const token = randomToken(32);
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    await sendEmail({
      to: user.email,
      subject: "Reset your Made by Myra password",
      html: layout("Reset your password", "<p>Click below to choose a new password. This link expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>", {
        label: "Choose a new password",
        url: siteUrl(`/reset-password?token=${token}`),
      }),
    });
  }
  return { ok: true };
}

export async function resetPassword(token: string, password: string): Promise<ActionResult> {
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { ok: false, error: pw.error.issues[0]?.message ?? "Invalid password." };
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(String(token).slice(0, 200)) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { ok: false, error: "This reset link is invalid or has expired. Please request a new one." };
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(pw.data) } }),
    db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
}
