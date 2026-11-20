"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { findCart, getOrCreateCart, summarizeCart, type CartSummary } from "@/lib/cart";
import { customizationSchema } from "@/lib/customization";
import { priceLine, PricingError } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/content";
import { getSession } from "@/lib/auth";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const addSchema = z.object({
  productId: z.string().min(1).max(40),
  colorId: z.string().min(1).max(40),
  sizeId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(50),
  customization: customizationSchema.nullable(),
});

export async function addToCart(input: z.input<typeof addSchema>): Promise<ActionResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your selections." };
  const { productId, colorId, sizeId, quantity, customization } = parsed.data;

  const product = await db.product.findUnique({ where: { id: productId }, include: { sizes: true, printLocations: true } });
  if (!product || product.status !== "PUBLISHED") return { ok: false, error: "This product is not available." };
  const variant = await db.productVariant.findUnique({ where: { productId_colorId_sizeId: { productId, colorId, sizeId } } });
  if (!variant || !variant.isAvailable) return { ok: false, error: "That color and size combination is unavailable." };
  if (variant.stock != null && variant.stock < quantity) return { ok: false, error: `Only ${variant.stock} left in stock.` };

  try {
    priceLine(product, variant, customization, quantity, await getPricingSettings());
  } catch (e) {
    if (e instanceof PricingError) return { ok: false, error: e.message };
    throw e;
  }

  const cart = await getOrCreateCart();
  const session = await getSession();

  // Verify any referenced uploads belong to this shopper and passed validation
  const uploadIds = new Set<string>();
  if (customization?.method === "UPLOAD") customization.placements.forEach((p) => p.uploadId && uploadIds.add(p.uploadId));
  if (customization?.method === "DESIGN_REQUEST") customization.request.inspirationUploadIds.forEach((id) => uploadIds.add(id));
  if (uploadIds.size) {
    const uploads = await db.upload.findMany({ where: { id: { in: [...uploadIds] } } });
    const owned = uploads.filter(
      (u) => u.status === "READY" && (u.cartId === cart.id || (session?.user?.id && u.userId === session.user.id)),
    );
    if (owned.length !== uploadIds.size) return { ok: false, error: "One of your files couldn't be verified. Please upload it again." };
    await db.upload.updateMany({ where: { id: { in: [...uploadIds] } }, data: { cartId: cart.id } });
  }

  // Merge identical non-custom lines
  const existing =
    !customization || customization.method === "NONE"
      ? cart.items.find((i) => i.variantId === variant.id && !i.customization && !i.savedForLater)
      : undefined;
  if (existing) {
    await db.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(50, existing.quantity + quantity) } });
  } else {
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId: variant.id,
        quantity,
        customization: customization && customization.method !== "NONE" ? customization : undefined,
      },
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

async function ownedItem(itemId: string) {
  const cart = await findCart();
  if (!cart) return null;
  return cart.items.find((i) => i.id === itemId) ?? null;
}

export async function updateCartQuantity(itemId: string, quantity: number): Promise<ActionResult> {
  const q = z.number().int().min(0).max(50).safeParse(quantity);
  if (!q.success) return { ok: false, error: "Invalid quantity." };
  const item = await ownedItem(itemId);
  if (!item) return { ok: false, error: "Item not found." };
  if (q.data === 0) await db.cartItem.delete({ where: { id: item.id } });
  else await db.cartItem.update({ where: { id: item.id }, data: { quantity: q.data } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeCartItem(itemId: string): Promise<ActionResult> {
  const item = await ownedItem(itemId);
  if (!item) return { ok: false, error: "Item not found." };
  await db.cartItem.delete({ where: { id: item.id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleSaveForLater(itemId: string): Promise<ActionResult> {
  const item = await ownedItem(itemId);
  if (!item) return { ok: false, error: "Item not found." };
  await db.cartItem.update({ where: { id: item.id }, data: { savedForLater: !item.savedForLater } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function getCartSummary(): Promise<CartSummary> {
  return summarizeCart(await findCart());
}

export async function toggleWishlist(productId: string): Promise<ActionResult<{ saved: boolean }>> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Please sign in to save favorites." };
  const id = z.string().max(40).parse(productId);
  const key = { userId_productId: { userId: session.user.id, productId: id } };
  const existing = await db.wishlistItem.findUnique({ where: key });
  if (existing) {
    await db.wishlistItem.delete({ where: key });
  } else {
    const product = await db.product.findUnique({ where: { id } });
    if (!product) return { ok: false, error: "Product not found." };
    await db.wishlistItem.create({ data: { userId: session.user.id, productId: id } });
  }
  revalidatePath("/account/wishlist");
  return { ok: true, data: { saved: !existing } };
}
