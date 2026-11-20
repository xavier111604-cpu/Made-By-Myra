"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./cart";

const schema = z.object({
  productId: z.string().max(40),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "Please write at least a sentence.").max(2000),
  photoUploadId: z.string().max(40).optional(),
});

/** Only verified purchasers (a paid order containing this product) may review. */
export async function submitReview(input: z.input<typeof schema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to leave a review." };
  if (!(await rateLimit(`review:${user.id}`, 5, 60 * 60))) return { ok: false, error: "Please try again later." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your review." };
  const d = parsed.data;

  const item = await db.orderItem.findFirst({
    where: { productId: d.productId, order: { userId: user.id, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, review: null },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Reviews are available to customers who purchased this item." };
  const existing = await db.review.findUnique({ where: { userId_productId: { userId: user.id, productId: d.productId } } });
  if (existing) return { ok: false, error: "You've already reviewed this item." };

  if (d.photoUploadId) {
    const up = await db.upload.findUnique({ where: { id: d.photoUploadId } });
    if (!up || up.userId !== user.id || up.purpose !== "REVIEW_PHOTO" || up.status !== "READY") return { ok: false, error: "Photo couldn't be verified." };
  }

  await db.review.create({
    data: {
      productId: d.productId,
      userId: user.id,
      orderItemId: item.id,
      rating: d.rating,
      title: d.title || null,
      body: d.body,
      photoUploadId: d.photoUploadId,
      approved: false,
    },
  });
  return { ok: true };
}
