"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordSchema, requireUser } from "@/lib/auth";
import type { ActionResult } from "./cart";

const addressSchema = z.object({
  name: z.string().trim().min(1).max(100),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().length(2).default("US"),
  phone: z.string().trim().max(30).optional(),
  isDefault: z.boolean().default(false),
});

export async function saveAddress(input: z.input<typeof addressSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please complete all required address fields." };
  const count = await db.address.count({ where: { userId: user.id } });
  if (count >= 10) return { ok: false, error: "You can save up to 10 addresses." };
  const d = parsed.data;
  const makeDefault = d.isDefault || count === 0;
  await db.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    await tx.address.create({ data: { ...d, country: d.country.toUpperCase(), line2: d.line2 || null, phone: d.phone || null, isDefault: makeDefault, userId: user.id } });
  });
  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.address.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const addr = await db.address.findFirst({ where: { id, userId: user.id } });
  if (!addr) return { ok: false, error: "Address not found." };
  await db.$transaction([
    db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function updateProfile(input: { name: string }): Promise<ActionResult> {
  const user = await requireUser();
  const name = z.string().trim().min(1).max(100).safeParse(input.name);
  if (!name.success) return { ok: false, error: "Please enter your name." };
  await db.user.update({ where: { id: user.id }, data: { name: name.data } });
  revalidatePath("/account/details");
  return { ok: true };
}

export async function changePassword(input: { current: string; next: string }): Promise<ActionResult> {
  const user = await requireUser();
  const next = passwordSchema.safeParse(input.next);
  if (!next.success) return { ok: false, error: next.error.issues[0]?.message ?? "Invalid password." };
  if (user.passwordHash) {
    const ok = await bcrypt.compare(String(input.current ?? ""), user.passwordHash);
    if (!ok) return { ok: false, error: "Your current password is incorrect." };
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next.data) } });
  return { ok: true };
}
