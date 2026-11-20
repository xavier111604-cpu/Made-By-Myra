import "server-only";
import { db } from "./db";
import { layout, ownerEmail, sendEmail, emailText as esc } from "./email";
import { formatMoney, orderNumber, siteUrl } from "./utils";
import { universalOrderUrl } from "./orders";
import { ORDER_STATUS_LABEL, trackingLink, CARRIER_LABEL } from "./labels";
import type { OrderStatus } from "@prisma/client";

async function loadOrder(orderId: string) {
  return db.order.findUnique({ where: { id: orderId }, include: { items: true, shipments: { orderBy: { shippedAt: "desc" }, take: 1 } } });
}

export async function notifyOrderPaid(orderId: string) {
  const order = await loadOrder(orderId);
  if (!order) return;
  const num = orderNumber(order.number);
  const rows = order.items
    .map((i) => `<li>${esc(i.productTitle)} — ${esc(i.colorName)}, ${esc(i.sizeLabel)} × ${i.quantity}${i.requiresDesign ? " (custom design request)" : ""}</li>`)
    .join("");
  const designNote = order.items.some((i) => i.requiresDesign)
    ? "<p>For your design request, we'll prepare a proof and email you when it's ready to review.</p>"
    : "";
  if (order.email) {
    await sendEmail({
      to: order.email,
      subject: `Thank you! Your Made by Myra order ${num}`,
      html: layout(
        `Thank you for your order ♡`,
        `<p>We've received your order <strong>${num}</strong> and payment of <strong>${formatMoney(order.totalCents, order.currency)}</strong>.</p><ul>${rows}</ul>${designNote}`,
        { label: "View your order", url: universalOrderUrl(order) },
      ),
    });
  }
  await sendEmail({
    to: ownerEmail(),
    subject: `New paid order ${num} — ${formatMoney(order.totalCents, order.currency)}`,
    html: layout(`New order ${num}`, `<p>${esc(order.customerName || order.email || "A customer")} placed an order.</p><ul>${rows}</ul>`, {
      label: "Open in dashboard",
      url: siteUrl(`/admin/orders/${order.id}`),
    }),
  });
}

export async function notifyProofReady(orderId: string, productTitle: string, note?: string | null) {
  const order = await loadOrder(orderId);
  if (!order?.email) return;
  await sendEmail({
    to: order.email,
    subject: `Your design proof is ready — ${orderNumber(order.number)}`,
    html: layout(
      "Your design proof is ready ♡",
      `<p>We've prepared a proof for your <strong>${esc(productTitle)}</strong>.</p>${note ? `<p><em>${esc(note)}</em></p>` : ""}<p>Please take a look and approve it or request changes.</p>`,
      { label: "Review your proof", url: universalOrderUrl(order) },
    ),
  });
}

export async function notifyOwnerProofResponse(orderId: string, approved: boolean, comment?: string | null) {
  const order = await loadOrder(orderId);
  if (!order) return;
  await sendEmail({
    to: ownerEmail(),
    subject: `${approved ? "Proof approved" : "Revision requested"} — ${orderNumber(order.number)}`,
    html: layout(
      approved ? "A proof was approved" : "A revision was requested",
      `<p>Order ${orderNumber(order.number)}.</p>${comment ? `<p>Customer comment: “${esc(comment)}”</p>` : ""}`,
      { label: "Open order", url: siteUrl(`/admin/orders/${order.id}`) },
    ),
  });
}

export async function notifyStatusChange(orderId: string, status: OrderStatus) {
  const order = await loadOrder(orderId);
  if (!order?.email) return;
  const ship = order.shipments[0];
  let extra = "";
  if (status === "SHIPPED" && ship) {
    const link = trackingLink(ship.carrier, ship.trackingNumber, ship.trackingUrl);
    extra = `<p>Carrier: ${CARRIER_LABEL[ship.carrier]}<br/>Tracking: ${link ? `<a href="${link}">${esc(ship.trackingNumber)}</a>` : esc(ship.trackingNumber)}</p>`;
  }
  await sendEmail({
    to: order.email,
    subject: `Order ${orderNumber(order.number)}: ${ORDER_STATUS_LABEL[status]}`,
    html: layout(`Your order is now: ${ORDER_STATUS_LABEL[status]}`, `<p>Order ${orderNumber(order.number)} has been updated.</p>${extra}`, {
      label: "Track your order",
      url: universalOrderUrl(order),
    }),
  });
}

export async function notifyNewMessage(orderId: string, toOwner: boolean, body: string) {
  const order = await loadOrder(orderId);
  if (!order) return;
  const to = toOwner ? ownerEmail() : order.email;
  if (!to) return;
  await sendEmail({
    to,
    subject: `New message about order ${orderNumber(order.number)}`,
    html: layout("You have a new message", `<p style="white-space:pre-wrap">${esc(body.slice(0, 2000))}</p>`, {
      label: toOwner ? "Reply in dashboard" : "View & reply",
      url: toOwner ? siteUrl(`/admin/orders/${order.id}`) : universalOrderUrl(order),
    }),
  });
}
