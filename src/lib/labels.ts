// Shared display labels (safe to import from client components)
import type { Carrier, OrderStatus, PaymentStatus } from "@prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "Order Received",
  AWAITING_DESIGN: "Awaiting Design",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_PRODUCTION: "In Production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "ORDER_RECEIVED",
  "AWAITING_DESIGN",
  "AWAITING_APPROVAL",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  CANCELLED: "Cancelled",
};

export const CARRIER_LABEL: Record<Carrier, string> = {
  USPS: "USPS",
  UPS: "UPS",
  FEDEX: "FedEx",
  DHL: "DHL",
  OTHER: "Other",
};

export function trackingLink(carrier: Carrier, tracking: string, custom?: string | null) {
  if (custom) return custom;
  const t = encodeURIComponent(tracking);
  switch (carrier) {
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case "UPS":
      return `https://www.ups.com/track?tracknum=${t}`;
    case "FEDEX":
      return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case "DHL":
      return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${t}`;
    default:
      return null;
  }
}

export const DESIGN_STYLES = ["Minimalist", "Cute", "Vintage", "Bold graphic", "Handwritten", "Floral", "Retro", "Other"];

export const CONTACT_CATEGORIES = [
  { value: "general", label: "General question" },
  { value: "order", label: "An existing order" },
  { value: "custom", label: "Custom design inquiry" },
  { value: "other", label: "Something else" },
];
