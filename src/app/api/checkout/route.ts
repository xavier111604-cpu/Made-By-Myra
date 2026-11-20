import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCart, parseCustomization } from "@/lib/cart";
import { getPricingSettings } from "@/lib/content";
import { discountAmount, priceLine, PricingError } from "@/lib/pricing";
import { automaticTaxEnabled, getStripe, shippingCountries, stripeConfigured } from "@/lib/stripe";
import { limitByIp } from "@/lib/rate-limit";
import { randomToken, siteUrl } from "@/lib/utils";
import type { CustomizationSnapshot } from "@/lib/customization";

const schema = z.object({ discountCode: z.string().trim().max(40).optional() });

export async function POST(req: Request) {
  if (!stripeConfigured) return NextResponse.json({ error: "Checkout isn't connected yet." }, { status: 503 });
  if (!(await limitByIp("checkout", 15, 10 * 60))) return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const [cart, user, settings] = await Promise.all([getOrCreateCart(), getCurrentUser(), getPricingSettings()]);
  const items = cart.items.filter((i) => !i.savedForLater);
  if (!items.length) return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });

  // ── Re-price everything on the server ──
  type Line = {
    item: (typeof items)[number];
    priced: ReturnType<typeof priceLine>;
    snapshot: CustomizationSnapshot;
    uploadIds: string[];
  };
  const lines: Line[] = [];
  try {
    for (const item of items) {
      const p = item.product;
      if (p.status !== "PUBLISHED") throw new PricingError(`${p.title} is no longer available.`);
      if (!item.variant.isAvailable) throw new PricingError(`${p.title} (${item.variant.color.name}, ${item.variant.size.label}) is unavailable.`);
      if (item.variant.stock != null && item.variant.stock < item.quantity) throw new PricingError(`Only ${item.variant.stock} of ${p.title} left in that option.`);
      const c = parseCustomization(item.customization);
      if (item.customization && !c) throw new PricingError(`Please re-add ${p.title} — its customization couldn't be read.`);
      const priced = priceLine(p, item.variant, c, item.quantity, settings);

      const uploadIds: string[] = [];
      let snapshot: CustomizationSnapshot = { method: "NONE" };
      if (c?.method === "UPLOAD") {
        const ups = await db.upload.findMany({ where: { id: { in: c.placements.flatMap((x) => (x.uploadId ? [x.uploadId] : [])) } } });
        snapshot = {
          method: "UPLOAD",
          instructions: c.instructions,
          placements: c.placements.map((pl) => {
            const up = ups.find((u) => u.id === pl.uploadId);
            if (pl.uploadId && (!up || up.status !== "READY" || (up.cartId !== cart.id && up.userId !== user?.id))) {
              throw new PricingError(`Artwork for ${p.title} needs to be uploaded again.`);
            }
            if (up) uploadIds.push(up.id);
            return {
              locationName: p.printLocations.find((l) => l.id === pl.locationId)?.name ?? "Print",
              uploadId: up?.id,
              filename: up?.filename,
              x: pl.x,
              y: pl.y,
              scale: pl.scale,
              text: pl.text,
              textFont: pl.textFont,
              textColor: pl.textColor,
            };
          }),
        };
      } else if (c?.method === "DESIGN_REQUEST") {
        uploadIds.push(...c.request.inspirationUploadIds);
        snapshot = {
          method: "DESIGN_REQUEST",
          request: { ...c.request, placementName: p.printLocations.find((l) => l.id === c.request.placementLocationId)?.name },
        };
      }
      lines.push({ item, priced, snapshot, uploadIds });
    }
  } catch (e) {
    if (e instanceof PricingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const subtotalCents = lines.reduce((s, l) => s + l.priced.lineTotalCents, 0);

  // ── Discount ──
  let discountCents = 0;
  let discountCodeId: string | undefined;
  if (parsed.data.discountCode) {
    const code = await db.discountCode.findUnique({ where: { code: parsed.data.discountCode.toUpperCase() } });
    if (!code) return NextResponse.json({ error: "That promo code wasn't found." }, { status: 400 });
    const d = discountAmount(code, subtotalCents);
    if (!d.ok) return NextResponse.json({ error: d.reason }, { status: 400 });
    discountCents = d.cents;
    discountCodeId = code.id;
  }

  // ── Create the pending order (marked paid only by the verified webhook) ──
  const accessToken = randomToken(24);
  const order = await db.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        userId: user?.id,
        email: user?.email,
        customerName: user?.name,
        accessToken,
        subtotalCents,
        discountCents,
        totalCents: subtotalCents - discountCents,
        discountCodeId,
      },
    });
    for (const l of lines) {
      const it = l.item;
      const oi = await tx.orderItem.create({
        data: {
          orderId: o.id,
          productId: it.productId,
          variantId: it.variantId,
          productTitle: it.product.title,
          colorName: it.variant.color.name,
          sizeLabel: it.variant.size.label,
          quantity: it.quantity,
          unitPriceCents: l.priced.unitPriceCents,
          customizationCents: l.priced.customizationCents,
          designFeeCents: l.priced.designFeeCents,
          lineTotalCents: l.priced.lineTotalCents,
          customization: l.snapshot as unknown as Prisma.InputJsonValue,
          requiresDesign: l.priced.requiresDesign,
        },
      });
      if (l.snapshot.method === "UPLOAD") {
        for (const pl of l.snapshot.placements) {
          if (pl.uploadId) {
            await tx.artworkFile.create({ data: { orderItemId: oi.id, uploadId: pl.uploadId, locationName: pl.locationName, posX: pl.x, posY: pl.y, scale: pl.scale } });
          }
        }
      }
      if (l.snapshot.method === "DESIGN_REQUEST") {
        const r = l.snapshot.request;
        await tx.designRequest.create({
          data: {
            orderItemId: oi.id,
            productId: it.productId,
            userId: user?.id,
            email: user?.email ?? "",
            name: user?.name,
            description: r.description,
            textToInclude: r.textToInclude,
            preferredColors: r.preferredColors,
            style: r.style,
            placement: r.placementName,
            occasion: r.occasion,
            notes: r.notes,
            inspirationUploadIds: r.inspirationUploadIds,
            status: "IN_ORDER",
          },
        });
      }
      if (l.uploadIds.length) await tx.upload.updateMany({ where: { id: { in: l.uploadIds } }, data: { orderId: o.id } });
    }
    return o;
  });

  // ── Stripe Checkout Session ──
  const stripe = getStripe();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const l of lines) {
    const it = l.item;
    const desc =
      l.snapshot.method === "UPLOAD"
        ? `Custom print: ${l.snapshot.placements.map((p) => p.locationName).join(", ")}`
        : l.snapshot.method === "DESIGN_REQUEST"
          ? "Custom design request"
          : undefined;
    lineItems.push({
      quantity: it.quantity,
      price_data: {
        currency: "usd",
        unit_amount: l.priced.unitPriceCents + l.priced.customizationCents,
        product_data: { name: `${it.product.title} — ${it.variant.color.name} / ${it.variant.size.label}`, description: desc },
      },
    });
    if (l.priced.designFeeCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: { currency: "usd", unit_amount: l.priced.designFeeCents, product_data: { name: `Design service — ${it.product.title}` } },
      });
    }
  }

  const rates = await db.shippingRate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, take: 5 });
  const afterDiscount = subtotalCents - discountCents;
  const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = rates.map((r) => ({
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: r.name,
      fixed_amount: { amount: r.freeOverCents != null && afterDiscount >= r.freeOverCents ? 0 : r.amountCents, currency: "usd" },
      ...(r.minDays && r.maxDays
        ? { delivery_estimate: { minimum: { unit: "business_day", value: r.minDays }, maximum: { unit: "business_day", value: r.maxDays } } }
        : {}),
    },
  }));

  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (discountCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: discountCents,
      currency: "usd",
      duration: "once",
      max_redemptions: 1,
      name: parsed.data.discountCode!.toUpperCase(),
    });
    discounts = [{ coupon: coupon.id }];
  }

  // Signed-in customers get a Stripe customer (pre-fills saved default address)
  let customer: string | undefined;
  if (user) {
    const defaultAddr = await db.address.findFirst({ where: { userId: user.id, isDefault: true } });
    const shipping = defaultAddr
      ? {
          name: defaultAddr.name,
          phone: defaultAddr.phone ?? undefined,
          address: {
            line1: defaultAddr.line1,
            line2: defaultAddr.line2 ?? undefined,
            city: defaultAddr.city,
            state: defaultAddr.state,
            postal_code: defaultAddr.postalCode,
            country: defaultAddr.country,
          },
        }
      : undefined;
    if (user.stripeCustomerId) {
      customer = user.stripeCustomerId;
      if (shipping) await stripe.customers.update(customer, { shipping }).catch(() => {});
    } else {
      const c = await stripe.customers.create({ email: user.email, name: user.name ?? undefined, shipping, metadata: { userId: user.id } });
      await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: c.id } });
      customer = c.id;
    }
  }

  const cartItemIds = items.map((i) => i.id).join(",");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    discounts,
    customer,
    customer_update: customer ? { shipping: "auto", address: "auto", name: "auto" } : undefined,
    billing_address_collection: "required",
    shipping_address_collection: { allowed_countries: shippingCountries },
    shipping_options: shippingOptions.length ? shippingOptions : undefined,
    phone_number_collection: { enabled: true },
    automatic_tax: { enabled: automaticTaxEnabled },
    client_reference_id: order.id,
    metadata: { type: "order", orderId: order.id, cartId: cart.id, cartItemIds: cartItemIds.length <= 490 ? cartItemIds : "" },
    payment_intent_data: { metadata: { orderId: order.id } },
    success_url: siteUrl(`/checkout/success?order=${order.id}&t=${accessToken}`),
    cancel_url: siteUrl(`/cart?cancelled=1`),
  });

  await db.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
  return NextResponse.json({ url: session.url });
}
