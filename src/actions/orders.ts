"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrderForViewer, addOrderEvent, universalOrderUrl } from "@/lib/orders";
import { getPricingSettings } from "@/lib/content";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { notifyNewMessage, notifyOwnerProofResponse } from "@/lib/notifications";
import { findCart, getOrCreateCart } from "@/lib/cart";
import { rateLimit } from "@/lib/rate-limit";
import type { CustomizationSnapshot, Customization } from "@/lib/customization";
import type { ActionResult } from "./cart";

const proofSchema = z.object({
  orderId: z.string().max(40),
  token: z.string().max(100).optional(),
  proofId: z.string().max(40),
  approve: z.boolean(),
  comment: z.string().trim().max(1500).optional(),
});

export async function respondToProof(input: z.input<typeof proofSchema>): Promise<ActionResult<{ checkoutUrl?: string }>> {
  const parsed = proofSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { orderId, token, proofId, approve, comment } = parsed.data;
  const viewer = await getOrderForViewer(orderId, token);
  if (!viewer || viewer.via === "admin") return { ok: false, error: "Not authorized." };
  const { order } = viewer;
  const item = order.items.find((i) => i.proofs.some((p) => p.id === proofId));
  const proof = item?.proofs.find((p) => p.id === proofId);
  if (!item || !proof) return { ok: false, error: "Proof not found." };
  if (proof.status !== "PENDING_REVIEW") return { ok: false, error: "This proof has already been answered." };
  if (item.proofs.some((p) => p.version > proof.version)) return { ok: false, error: "A newer proof is available." };

  if (approve) {
    await db.$transaction(async (tx) => {
      await tx.designProof.update({ where: { id: proof.id }, data: { status: "APPROVED", customerComment: comment || null, respondedAt: new Date() } });
      await tx.orderItem.update({ where: { id: item.id }, data: { designApproved: true } });
      const remaining = order.items.filter((i) => i.requiresDesign && i.id !== item.id && !i.designApproved);
      if (remaining.length === 0 && ["AWAITING_APPROVAL", "AWAITING_DESIGN"].includes(order.status)) {
        await tx.order.update({ where: { id: order.id }, data: { status: "IN_PRODUCTION" } });
      }
      await tx.orderEvent.create({
        data: { orderId: order.id, type: "proof_approved", message: `Design proof v${proof.version} for ${item.productTitle} approved.${remaining.length === 0 ? " Production can begin." : ""}` },
      });
    });
    await notifyOwnerProofResponse(order.id, true, comment);
    revalidatePath(`/account/orders/${order.id}`);
    return { ok: true };
  }

  if (!comment || comment.length < 3) return { ok: false, error: "Please tell us what you'd like changed." };
  const settings = await getPricingSettings();
  const included = item.revisionsUsed < settings.includedRevisions;

  if (!included && settings.extraRevisionFeeCents > 0) {
    if (!stripeConfigured) return { ok: false, error: "Extra revisions require payment, which isn't available right now. Please message us." };
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: settings.extraRevisionFeeCents, product_data: { name: `Additional design revision — ${item.productTitle}` } } }],
      customer_email: order.email ?? undefined,
      metadata: { type: "revision_fee", orderId: order.id, orderItemId: item.id, proofId: proof.id, comment: comment.slice(0, 480) },
      success_url: `${universalOrderUrl(order)}&revision=paid`,
      cancel_url: universalOrderUrl(order),
    });
    return { ok: true, data: { checkoutUrl: session.url ?? undefined } };
  }

  await db.$transaction(async (tx) => {
    await tx.designProof.update({ where: { id: proof.id }, data: { status: "REVISION_REQUESTED", customerComment: comment, respondedAt: new Date() } });
    await tx.orderItem.update({ where: { id: item.id }, data: { revisionsUsed: { increment: 1 } } });
    await tx.order.update({ where: { id: order.id }, data: { status: "AWAITING_DESIGN" } });
    await tx.orderEvent.create({ data: { orderId: order.id, type: "revision_requested", message: `Revision requested for ${item.productTitle}.` } });
  });
  await notifyOwnerProofResponse(order.id, false, comment);
  revalidatePath(`/account/orders/${order.id}`);
  return { ok: true };
}

const messageSchema = z.object({
  orderId: z.string().max(40),
  token: z.string().max(100).optional(),
  body: z.string().trim().min(1, "Please write a message.").max(4000),
  uploadId: z.string().max(40).optional(),
});

export async function postCustomerMessage(input: z.input<typeof messageSchema>): Promise<ActionResult> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message." };
  const { orderId, token, body, uploadId } = parsed.data;
  if (!(await rateLimit(`msg:${orderId}`, 20, 60 * 60))) return { ok: false, error: "Please slow down a little and try again later." };
  const viewer = await getOrderForViewer(orderId, token);
  if (!viewer || viewer.via === "admin") return { ok: false, error: "Not authorized." };

  let attach: string | undefined;
  if (uploadId) {
    const [up, cart, user] = await Promise.all([db.upload.findUnique({ where: { id: uploadId } }), findCart(), getCurrentUser()]);
    const owns = up && ((cart && up.cartId === cart.id) || (user && up.userId === user.id));
    if (up && owns && up.status === "READY" && up.purpose === "MESSAGE" && !up.orderId) {
      await db.upload.update({ where: { id: up.id }, data: { orderId } });
      attach = up.id;
    }
  }
  await db.orderMessage.create({ data: { orderId, author: "CUSTOMER", body, uploadId: attach } });
  await notifyNewMessage(orderId, true, body);
  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true };
}

/** Re-adds the items of a past order to the bag (design-request items are skipped). */
export async function reorder(orderId: string): Promise<ActionResult<{ added: number; skipped: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const order = await db.order.findFirst({ where: { id: z.string().max(40).parse(orderId), userId: user.id }, include: { items: true } });
  if (!order) return { ok: false, error: "Order not found." };
  const cart = await getOrCreateCart();
  let added = 0;
  let skipped = 0;

  for (const item of order.items) {
    if (!item.productId || !item.variantId || item.requiresDesign) {
      skipped++;
      continue;
    }
    const [product, variant] = await Promise.all([
      db.product.findUnique({ where: { id: item.productId }, include: { printLocations: true } }),
      db.productVariant.findUnique({ where: { id: item.variantId } }),
    ]);
    if (!product || product.status !== "PUBLISHED" || !variant?.isAvailable) {
      skipped++;
      continue;
    }
    const snap = item.customization as CustomizationSnapshot | null;
    let customization: Customization | null = null;
    if (snap?.method === "UPLOAD") {
      const placements = snap.placements.map((p) => ({ ...p, locationId: product.printLocations.find((l) => l.name === p.locationName)?.id }));
      if (placements.some((p) => !p.locationId)) {
        skipped++;
        continue;
      }
      customization = {
        method: "UPLOAD",
        instructions: snap.instructions,
        placements: placements.map((p) => ({
          locationId: p.locationId!,
          uploadId: p.uploadId,
          x: p.x,
          y: p.y,
          scale: p.scale,
          text: p.text,
          textFont: p.textFont as "script" | "sans" | undefined,
          textColor: p.textColor,
        })),
      };
      const ids = placements.flatMap((p) => (p.uploadId ? [p.uploadId] : []));
      if (ids.length) await db.upload.updateMany({ where: { id: { in: ids }, orderId: order.id }, data: { cartId: cart.id, userId: user.id } });
    }
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        variantId: variant.id,
        quantity: item.quantity,
        customization: (customization ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    added++;
  }
  await addOrderEvent(order.id, "reorder", `Customer re-added ${added} item(s) to their bag.`, false);
  revalidatePath("/", "layout");
  return { ok: true, data: { added, skipped } };
}
