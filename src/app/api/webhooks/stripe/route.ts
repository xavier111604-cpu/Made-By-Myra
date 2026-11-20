import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { addOrderEvent, nextStatusAfterDesign } from "@/lib/orders";
import { notifyOrderPaid, notifyOwnerProofResponse } from "@/lib/notifications";
import { formatMoney } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Stripe webhook — the ONLY place an order is marked paid.
 * Signature is verified with STRIPE_WEBHOOK_SECRET; events are processed idempotently.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("Stripe signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (await db.stripeEvent.findUnique({ where: { id: event.id } })) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") await handlePaidSession(session);
        break;
      }
      case "checkout.session.async_payment_failed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.type === "order" && s.metadata.orderId) {
          await db.order.updateMany({ where: { id: s.metadata.orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } });
          await addOrderEvent(s.metadata.orderId, "payment_failed", "Payment failed.", true);
        }
        break;
      }
      case "checkout.session.expired": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.type === "order" && s.metadata.orderId) {
          await db.order.updateMany({
            where: { id: s.metadata.orderId, paymentStatus: "PENDING" },
            data: { paymentStatus: "CANCELLED", status: "CANCELLED" },
          });
        }
        break;
      }
      case "charge.refunded": {
        await handleRefund(event.data.object as Stripe.Charge);
        break;
      }
      default:
        break;
    }
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } }).catch((e) => {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    });
  } catch (err) {
    console.error(`Webhook ${event.type} failed`, err);
    // 500 tells Stripe to retry later
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

type Addr = Stripe.Address | null | undefined;
const addrJson = (name: string | null | undefined, a: Addr) =>
  a ? { name: name ?? null, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postal_code, country: a.country } : undefined;

async function handlePaidSession(session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {};
  if (meta.type === "revision_fee") return handleRevisionFee(session);
  if (meta.type !== "order" || !meta.orderId) return;

  const order = await db.order.findUnique({ where: { id: meta.orderId }, include: { items: true } });
  if (!order || order.paymentStatus === "PAID") return;

  // API-version tolerant: newer Stripe versions move shipping details under collected_information
  const shippingDetails =
    (session as unknown as { collected_information?: { shipping_details?: { name?: string; address?: Stripe.Address } } }).collected_information?.shipping_details ??
    (session as unknown as { shipping_details?: { name?: string; address?: Stripe.Address } }).shipping_details;
  const cd = session.customer_details;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const totals = session.total_details;

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
        status: nextStatusAfterDesign(order.items),
        email: order.email ?? cd?.email ?? undefined,
        customerName: order.customerName ?? cd?.name ?? undefined,
        phone: cd?.phone ?? undefined,
        shippingAddress: addrJson(shippingDetails?.name, shippingDetails?.address),
        billingAddress: addrJson(cd?.name, cd?.address),
        shippingCents: totals?.amount_shipping ?? 0,
        taxCents: totals?.amount_tax ?? 0,
        discountCents: totals?.amount_discount ?? order.discountCents,
        totalCents: session.amount_total ?? order.totalCents,
        currency: session.currency ?? "usd",
        stripePaymentIntentId: paymentIntentId,
      },
    });
    await tx.payment.create({
      data: {
        orderId: order.id,
        type: "ORDER",
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        amountCents: session.amount_total ?? 0,
        status: "paid",
      },
    });
    // Guest design requests get the email collected by Stripe
    if (cd?.email) await tx.designRequest.updateMany({ where: { orderItem: { orderId: order.id }, email: "" }, data: { email: cd.email } });

    for (const item of order.items) {
      if (item.variantId) {
        const v = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (v && v.stock != null) {
          await tx.productVariant.update({ where: { id: v.id }, data: { stock: Math.max(0, v.stock - item.quantity) } });
          await tx.inventoryLog.create({ data: { variantId: v.id, change: -item.quantity, reason: `Order ${order.number}` } });
        }
      }
      if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { soldCount: { increment: item.quantity } } });
    }
    if (order.discountCodeId) await tx.discountCode.update({ where: { id: order.discountCodeId }, data: { redemptions: { increment: 1 } } });

    // Clear the purchased items from the cart
    if (meta.cartItemIds) await tx.cartItem.deleteMany({ where: { id: { in: meta.cartItemIds.split(",") } } });
    else if (meta.cartId) await tx.cartItem.deleteMany({ where: { cartId: meta.cartId, savedForLater: false } });

    await tx.orderEvent.create({
      data: { orderId: order.id, type: "paid", message: `Payment of ${formatMoney(session.amount_total ?? 0)} confirmed. Order received.`, visibleToCustomer: true },
    });
  });

  await notifyOrderPaid(order.id);
}

async function handleRevisionFee(session: Stripe.Checkout.Session) {
  const { orderId, orderItemId, proofId, comment } = session.metadata ?? {};
  if (!orderId || !orderItemId || !proofId) return;
  if (await db.payment.findUnique({ where: { stripeSessionId: session.id } })) return;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: { orderId, type: "REVISION_FEE", stripeSessionId: session.id, stripePaymentIntentId: paymentIntentId, amountCents: session.amount_total ?? 0, status: "paid" },
    });
    await tx.designProof.update({ where: { id: proofId }, data: { status: "REVISION_REQUESTED", customerComment: comment || null, respondedAt: new Date() } });
    await tx.orderItem.update({ where: { id: orderItemId }, data: { revisionsUsed: { increment: 1 } } });
    await tx.order.update({ where: { id: orderId }, data: { status: "AWAITING_DESIGN" } });
    await tx.orderEvent.create({ data: { orderId, type: "revision_requested", message: `Extra revision requested (fee ${formatMoney(session.amount_total ?? 0)} paid).` } });
  });
  await notifyOwnerProofResponse(orderId, false, comment);
}

async function handleRefund(charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const payment = await db.payment.findFirst({ where: { stripePaymentIntentId: pi } });
  if (!payment) return;
  const refunded = charge.amount_refunded;
  await db.payment.update({
    where: { id: payment.id },
    data: { refundedCents: refunded, status: refunded >= payment.amountCents ? "refunded" : "partially_refunded" },
  });
  const payments = await db.payment.findMany({ where: { orderId: payment.orderId } });
  const paid = payments.reduce((s, p) => s + p.amountCents, 0);
  const back = payments.reduce((s, p) => s + p.refundedCents, 0);
  await db.order.update({ where: { id: payment.orderId }, data: { paymentStatus: back >= paid ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
  await addOrderEvent(payment.orderId, "refund", `Refund processed: ${formatMoney(refunded)} total refunded on this payment.`, true);
}
