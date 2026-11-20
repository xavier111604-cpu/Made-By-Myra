"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { designRequestSchema } from "@/lib/customization";
import { getSession } from "@/lib/auth";
import { limitByIp } from "@/lib/rate-limit";
import { findCart } from "@/lib/cart";
import { layout, ownerEmail, sendEmail, emailText as esc } from "@/lib/email";
import { siteUrl } from "@/lib/utils";
import type { ActionResult } from "./cart";

const quoteSchema = z.object({
  productId: z.string().max(40),
  colorId: z.string().max(40).optional(),
  sizeId: z.string().max(40).optional(),
  quantity: z.number().int().min(1).max(500),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Please enter a valid email so we can send your quote.").max(200),
  request: designRequestSchema,
});

/** Design request that needs pricing first: stored as a quote request, nothing is charged. */
export async function submitQuoteRequest(input: z.input<typeof quoteSchema>): Promise<ActionResult> {
  if (!(await limitByIp("quote", 5, 60 * 60))) return { ok: false, error: "Too many requests. Please try again later." };
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const product = await db.product.findUnique({ where: { id: d.productId }, include: { colors: true, sizes: true, printLocations: true } });
  if (!product || product.status !== "PUBLISHED" || !product.allowDesignRequest) return { ok: false, error: "This product isn't available for design requests." };

  // Only accept inspiration uploads that belong to this shopper
  const session = await getSession();
  const cart = await findCart();
  const uploads = d.request.inspirationUploadIds.length
    ? await db.upload.findMany({ where: { id: { in: d.request.inspirationUploadIds }, status: "READY" } })
    : [];
  const ownedIds = uploads.filter((u) => (cart && u.cartId === cart.id) || (session?.user?.id && u.userId === session.user.id)).map((u) => u.id);

  const color = product.colors.find((c) => c.id === d.colorId)?.name;
  const size = product.sizes.find((s) => s.id === d.sizeId)?.label;
  const placement = product.printLocations.find((l) => l.id === d.request.placementLocationId)?.name;

  const dr = await db.designRequest.create({
    data: {
      productId: product.id,
      userId: session?.user?.id,
      email: d.email.toLowerCase(),
      name: d.name,
      description: d.request.description,
      textToInclude: d.request.textToInclude,
      preferredColors: d.request.preferredColors,
      style: d.request.style,
      placement,
      occasion: d.request.occasion,
      notes: [d.request.notes, `Product: ${product.title}${color ? `, ${color}` : ""}${size ? `, ${size}` : ""} × ${d.quantity}`].filter(Boolean).join("\n"),
      inspirationUploadIds: ownedIds,
      status: "QUOTE_REQUESTED",
    },
  });

  await sendEmail({
    to: ownerEmail(),
    subject: `New design quote request — ${product.title}`,
    html: layout(
      "New design quote request",
      `<p><strong>${esc(d.name || d.email)}</strong> (${esc(d.email)}) asked for a quote.</p><p style="white-space:pre-wrap">${esc(d.request.description)}</p>`,
      { label: "Open in dashboard", url: siteUrl(`/admin/requests#${dr.id}`) },
    ),
    replyTo: d.email,
  });
  await sendEmail({
    to: d.email,
    subject: "We received your design request ♡",
    html: layout(
      "Thank you for your design request",
      `<p>We've received your idea for a <strong>${esc(product.title)}</strong> and will reply with a quote. Nothing has been charged.</p>`,
    ),
  });
  return { ok: true };
}
