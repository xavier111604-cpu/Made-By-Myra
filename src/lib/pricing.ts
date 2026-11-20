import type { PrintLocation, Product, ProductSize, ProductVariant } from "@prisma/client";
import type { Customization } from "./customization";
import type { PricingSettings } from "./content";

export type PricedProduct = Product & { sizes: ProductSize[]; printLocations: PrintLocation[] };

export class PricingError extends Error {}

/** Variant unit price: explicit variant price wins, otherwise base price + size surcharge. */
export function variantUnitPrice(product: PricedProduct, variant: ProductVariant) {
  if (variant.priceOverrideCents != null) return variant.priceOverrideCents;
  const size = product.sizes.find((s) => s.id === variant.sizeId);
  return product.basePriceCents + (size?.surchargeCents ?? 0);
}

export function designFeeFor(product: Product, settings: PricingSettings) {
  return product.designFeeCents ?? settings.designFeeCents;
}

/**
 * Server-authoritative price for a cart/order line. Never trust client-side totals.
 */
export function priceLine(
  product: PricedProduct,
  variant: ProductVariant,
  customization: Customization | null,
  quantity: number,
  settings: PricingSettings,
) {
  const unitPriceCents = variantUnitPrice(product, variant);
  let customizationCents = 0;
  let designFeeCents = 0;
  let requiresDesign = false;
  const c = customization ?? { method: "NONE" as const };

  if (c.method !== "NONE" && !product.isCustomizable) throw new PricingError("This product can't be customized.");

  if (c.method === "UPLOAD") {
    if (!product.allowUpload) throw new PricingError("Artwork uploads aren't available for this product.");
    const seen = new Set<string>();
    for (const p of c.placements) {
      if (seen.has(p.locationId)) throw new PricingError("Each print location can only be used once.");
      seen.add(p.locationId);
      const loc = product.printLocations.find((l) => l.id === p.locationId);
      if (!loc) throw new PricingError("That print location isn't available for this product.");
      customizationCents += loc.priceCents;
    }
  }

  if (c.method === "DESIGN_REQUEST") {
    if (!product.allowDesignRequest) throw new PricingError("Design requests aren't available for this product.");
    if (product.designRequestMode === "QUOTE") throw new PricingError("This product needs a quote before ordering.");
    requiresDesign = true;
    designFeeCents = designFeeFor(product, settings);
    if (c.request.placementLocationId) {
      const loc = product.printLocations.find((l) => l.id === c.request.placementLocationId);
      if (loc) customizationCents += loc.priceCents;
    }
  }

  const lineTotalCents = (unitPriceCents + customizationCents) * quantity + designFeeCents;
  return { unitPriceCents, customizationCents, designFeeCents, lineTotalCents, requiresDesign };
}

export function startingPrice(product: { basePriceCents: number; sizes: { surchargeCents: number }[]; variants?: { priceOverrideCents: number | null }[] }) {
  const candidates = [product.basePriceCents + Math.min(0, ...product.sizes.map((s) => s.surchargeCents))];
  for (const v of product.variants ?? []) if (v.priceOverrideCents != null) candidates.push(v.priceOverrideCents);
  return Math.min(...candidates);
}

export type DiscountLike = {
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotalCents: number | null;
  maxRedemptions: number | null;
  redemptions: number;
  expiresAt: Date | null;
  active: boolean;
};

export function discountAmount(code: DiscountLike, subtotalCents: number): { ok: true; cents: number } | { ok: false; reason: string } {
  if (!code.active) return { ok: false, reason: "That code is no longer active." };
  if (code.expiresAt && code.expiresAt < new Date()) return { ok: false, reason: "That code has expired." };
  if (code.maxRedemptions != null && code.redemptions >= code.maxRedemptions) return { ok: false, reason: "That code has been fully redeemed." };
  if (code.minSubtotalCents && subtotalCents < code.minSubtotalCents) {
    return { ok: false, reason: `This code needs a subtotal of at least $${(code.minSubtotalCents / 100).toFixed(2)}.` };
  }
  const cents = code.type === "PERCENT" ? Math.round((subtotalCents * Math.min(100, code.value)) / 100) : code.value;
  return { ok: true, cents: Math.min(cents, subtotalCents) };
}
