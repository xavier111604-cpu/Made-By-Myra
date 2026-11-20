import "server-only";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import { safeEqual, siteUrl } from "./utils";

export const orderDetailInclude = {
  items: {
    include: {
      artworks: true,
      designRequest: true,
      proofs: { orderBy: { version: "asc" } },
      product: { select: { slug: true, images: { take: 1, orderBy: { sortOrder: "asc" } } } },
      review: { select: { id: true } },
    },
  },
  events: { orderBy: { createdAt: "asc" } },
  messages: { orderBy: { createdAt: "asc" } },
  shipments: { orderBy: { shippedAt: "desc" } },
  payments: { include: { refunds: true } },
  discountCode: { select: { code: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export type OrderViewer = { order: OrderDetail; via: "owner" | "token" | "admin" };

/**
 * Who may view an order: the admin, the signed-in customer who placed it,
 * or anyone holding the secret access token emailed to the customer (guest checkout).
 */
export async function getOrderForViewer(orderId: string, token?: string | null): Promise<OrderViewer | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
  if (!order) return null;
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") return { order, via: "admin" };
  if (user && order.userId === user.id) return { order, via: "owner" };
  if (token && safeEqual(token, order.accessToken)) return { order, via: "token" };
  return null;
}

/** Lightweight access check (no heavy includes) used by the file download route. */
export async function canAccessOrder(orderId: string, token?: string | null) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { userId: true, accessToken: true } });
  if (!order) return false;
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") return true;
  if (user && order.userId === user.id) return true;
  return Boolean(token && safeEqual(token, order.accessToken));
}

export function customerOrderUrl(order: { id: string; accessToken: string; userId: string | null }) {
  return order.userId ? siteUrl(`/account/orders/${order.id}`) : siteUrl(`/order/${order.id}?t=${order.accessToken}`);
}

/** Link that works for both account holders and guests (token is checked only when not signed in). */
export function universalOrderUrl(order: { id: string; accessToken: string }) {
  return siteUrl(`/order/${order.id}?t=${order.accessToken}`);
}

export async function addOrderEvent(orderId: string, type: string, message: string, visibleToCustomer = true) {
  await db.orderEvent.create({ data: { orderId, type, message, visibleToCustomer } });
}

/** Choose the order status after payment or after a design step. */
export function nextStatusAfterDesign(items: { requiresDesign: boolean; designApproved: boolean }[]): OrderStatus {
  const designItems = items.filter((i) => i.requiresDesign);
  if (designItems.length === 0) return "ORDER_RECEIVED";
  if (designItems.every((i) => i.designApproved)) return "IN_PRODUCTION";
  return "AWAITING_DESIGN";
}
