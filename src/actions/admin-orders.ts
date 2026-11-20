"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Carrier, OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { addOrderEvent } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { notifyNewMessage, notifyProofReady, notifyStatusChange } from "@/lib/notifications";
import { ORDER_STATUS_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/utils";
import { layout, sendEmail, emailText as esc } from "@/lib/email";
import type { ActionResult } from "./cart";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as [OrderStatus, ...OrderStatus[]];

function refresh(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const orderId = z.string().max(40).parse(formData.get("orderId"));
  const status = z.enum(STATUSES).parse(formData.get("status"));
  const notify = formData.get("notify") === "on";
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === status) return;
  await db.order.update({ where: { id: orderId }, data: { status } });
  await addOrderEvent(orderId, "status", `Status changed to ${ORDER_STATUS_LABEL[status]}.`, true);
  if (notify) await notifyStatusChange(orderId, status);
  refresh(orderId);
}

export async function addShipment(formData: FormData) {
  await requireAdmin();
  const data = z
    .object({
      orderId: z.string().max(40),
      carrier: z.enum(["USPS", "UPS", "FEDEX", "DHL", "OTHER"]),
      trackingNumber: z.string().trim().min(3).max(60),
      trackingUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
    })
    .parse(Object.fromEntries(formData));
  await db.shipment.create({
    data: { orderId: data.orderId, carrier: data.carrier as Carrier, trackingNumber: data.trackingNumber, trackingUrl: data.trackingUrl || null },
  });
  await db.order.update({ where: { id: data.orderId }, data: { status: "SHIPPED" } });
  await addOrderEvent(data.orderId, "shipped", `Shipped via ${data.carrier} (${data.trackingNumber}).`, true);
  await notifyStatusChange(data.orderId, "SHIPPED");
  refresh(data.orderId);
}

export async function markDelivered(formData: FormData) {
  await requireAdmin();
  const orderId = z.string().max(40).parse(formData.get("orderId"));
  await db.shipment.updateMany({ where: { orderId, deliveredAt: null }, data: { deliveredAt: new Date() } });
  await db.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
  await addOrderEvent(orderId, "delivered", "Delivered.", true);
  await notifyStatusChange(orderId, "DELIVERED");
  refresh(orderId);
}

export async function saveInternalNotes(formData: FormData) {
  await requireAdmin();
  const orderId = z.string().max(40).parse(formData.get("orderId"));
  const notes = z.string().max(5000).parse(formData.get("notes") ?? "");
  await db.order.update({ where: { id: orderId }, data: { internalNotes: notes } });
  refresh(orderId);
}

export async function uploadProof(input: { orderItemId: string; uploadId: string; note?: string }): Promise<ActionResult> {
  await requireAdmin();
  const d = z.object({ orderItemId: z.string().max(40), uploadId: z.string().max(40), note: z.string().trim().max(1500).optional() }).parse(input);
  const item = await db.orderItem.findUnique({ where: { id: d.orderItemId }, include: { proofs: true, order: true } });
  if (!item) return { ok: false, error: "Item not found." };
  if (item.order.paymentStatus !== "PAID" && item.order.paymentStatus !== "PARTIALLY_REFUNDED") return { ok: false, error: "This order isn't paid." };
  const up = await db.upload.findUnique({ where: { id: d.uploadId } });
  if (!up || up.purpose !== "PROOF" || up.status !== "READY") return { ok: false, error: "Proof file couldn't be verified." };
  const version = item.proofs.reduce((m, p) => Math.max(m, p.version), 0) + 1;
  await db.$transaction([
    db.upload.update({ where: { id: up.id }, data: { orderId: item.orderId } }),
    db.designProof.create({ data: { orderItemId: item.id, version, uploadId: up.id, ownerNote: d.note || null } }),
    db.orderItem.update({ where: { id: item.id }, data: { designApproved: false } }),
    db.order.update({ where: { id: item.orderId }, data: { status: "AWAITING_APPROVAL" } }),
    db.orderEvent.create({ data: { orderId: item.orderId, type: "proof", message: `Design proof v${version} ready for ${item.productTitle}.` } }),
  ]);
  await notifyProofReady(item.orderId, item.productTitle, d.note);
  refresh(item.orderId);
  return { ok: true };
}

export async function postOwnerMessage(input: { orderId: string; body: string; uploadId?: string }): Promise<ActionResult> {
  await requireAdmin();
  const d = z.object({ orderId: z.string().max(40), body: z.string().trim().min(1).max(4000), uploadId: z.string().max(40).optional() }).safeParse(input);
  if (!d.success) return { ok: false, error: "Please write a message." };
  let uploadId: string | undefined;
  if (d.data.uploadId) {
    const up = await db.upload.findUnique({ where: { id: d.data.uploadId } });
    if (up?.status === "READY") {
      await db.upload.update({ where: { id: up.id }, data: { orderId: d.data.orderId } });
      uploadId = up.id;
    }
  }
  await db.orderMessage.create({ data: { orderId: d.data.orderId, author: "OWNER", body: d.data.body, uploadId } });
  await notifyNewMessage(d.data.orderId, false, d.data.body);
  refresh(d.data.orderId);
  return { ok: true };
}

export async function issueRefund(input: { orderId: string; paymentId: string; amount: string; reason?: string }): Promise<ActionResult> {
  await requireAdmin();
  const d = z.object({ orderId: z.string().max(40), paymentId: z.string().max(40), amount: z.string().max(20), reason: z.string().max(300).optional() }).parse(input);
  const payment = await db.payment.findFirst({ where: { id: d.paymentId, orderId: d.orderId } });
  if (!payment?.stripePaymentIntentId) return { ok: false, error: "Payment not found." };
  const cents = Math.round(parseFloat(d.amount) * 100);
  const refundable = payment.amountCents - payment.refundedCents;
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false, error: "Enter a refund amount." };
  if (cents > refundable) return { ok: false, error: `You can refund up to ${formatMoney(refundable)} on this payment.` };
  try {
    const refund = await getStripe().refunds.create(
      { payment_intent: payment.stripePaymentIntentId, amount: cents, metadata: { orderId: d.orderId, reason: d.reason ?? "" } },
      { idempotencyKey: `refund-${payment.id}-${cents}-${payment.refundedCents}` },
    );
    await db.refund.upsert({
      where: { stripeRefundId: refund.id },
      update: {},
      create: { paymentId: payment.id, stripeRefundId: refund.id, amountCents: cents, reason: d.reason },
    });
    await addOrderEvent(d.orderId, "refund_requested", `Refund of ${formatMoney(cents)} issued${d.reason ? ` — ${d.reason}` : ""}.`, false);
  } catch (e) {
    return { ok: false, error: `Stripe refused the refund: ${(e as Error).message}` };
  }
  refresh(d.orderId);
  return { ok: true };
}

export async function cancelOrder(formData: FormData) {
  await requireAdmin();
  const orderId = z.string().max(40).parse(formData.get("orderId"));
  const restock = formData.get("restock") === "on";
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.status === "CANCELLED") return;
  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", ...(order.paymentStatus === "PENDING" ? { paymentStatus: "CANCELLED" } : {}) } });
    if (restock && order.paymentStatus !== "PENDING" && order.status !== "SHIPPED" && order.status !== "DELIVERED") {
      for (const it of order.items) {
        if (!it.variantId) continue;
        const v = await tx.productVariant.findUnique({ where: { id: it.variantId } });
        if (v?.stock != null) {
          await tx.productVariant.update({ where: { id: v.id }, data: { stock: v.stock + it.quantity } });
          await tx.inventoryLog.create({ data: { variantId: v.id, change: it.quantity, reason: `Order ${order.number} cancelled` } });
        }
      }
    }
    await tx.orderEvent.create({ data: { orderId, type: "cancelled", message: "Order cancelled. Any refund is processed separately.", visibleToCustomer: true } });
  });
  await notifyStatusChange(orderId, "CANCELLED");
  refresh(orderId);
}

export async function replyToQuote(formData: FormData) {
  await requireAdmin();
  const id = z.string().max(40).parse(formData.get("id"));
  const reply = z.string().trim().min(1).max(4000).parse(formData.get("reply"));
  const dr = await db.designRequest.findUniqueOrThrow({ where: { id } });
  await db.designRequest.update({ where: { id }, data: { ownerReply: reply, status: "QUOTE_SENT" } });
  await sendEmail({
    to: dr.email,
    subject: "Your Made by Myra design quote ♡",
    html: layout("About your design request", `<p style="white-space:pre-wrap">${esc(reply)}</p><p>Just reply to this email with any questions.</p>`),
  });
  revalidatePath("/admin/requests");
}

export async function closeRequest(formData: FormData) {
  await requireAdmin();
  const id = z.string().max(40).parse(formData.get("id"));
  await db.designRequest.update({ where: { id }, data: { status: "CLOSED" } });
  revalidatePath("/admin/requests");
}

export async function toggleContactHandled(formData: FormData) {
  await requireAdmin();
  const id = z.string().max(40).parse(formData.get("id"));
  const m = await db.contactMessage.findUniqueOrThrow({ where: { id } });
  await db.contactMessage.update({ where: { id }, data: { handled: !m.handled } });
  revalidatePath("/admin/requests");
}
