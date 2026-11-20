import "server-only";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { getSession } from "./auth";
import { randomToken } from "./utils";
import { customizationSchema, type Customization } from "./customization";
import { priceLine } from "./pricing";
import { getPricingSettings } from "./content";

export const CART_COOKIE = "mbm_cart";

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: { include: { sizes: true, printLocations: true, colors: true, images: { orderBy: { sortOrder: "asc" } } } },
      variant: { include: { color: true, size: true } },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/** Read-only lookup, safe to call while rendering. */
export async function findCart(): Promise<CartWithItems | null> {
  const session = await getSession();
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (session?.user?.id) {
    const userCart = await db.cart.findUnique({ where: { userId: session.user.id }, include: cartInclude });
    if (userCart) return userCart;
  }
  if (!token) return null;
  const cart = await db.cart.findUnique({ where: { token }, include: cartInclude });
  if (cart && cart.userId && cart.userId !== session?.user?.id) return null;
  return cart;
}

/** For server actions / route handlers only: creates the cart and merges a guest cart on sign-in. */
export async function getOrCreateCart(): Promise<CartWithItems> {
  const session = await getSession();
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  const userId = session?.user?.id;

  const guestCart = token ? await db.cart.findUnique({ where: { token } }) : null;
  const usableGuest = guestCart && (!guestCart.userId || guestCart.userId === userId) ? guestCart : null;

  let cartId: string;
  let cartToken: string;

  if (userId) {
    const userCart = await db.cart.findUnique({ where: { userId } });
    if (userCart && usableGuest && usableGuest.id !== userCart.id) {
      await db.cartItem.updateMany({ where: { cartId: usableGuest.id }, data: { cartId: userCart.id } });
      await db.upload.updateMany({ where: { cartId: usableGuest.id }, data: { cartId: userCart.id } });
      await db.cart.delete({ where: { id: usableGuest.id } });
      cartId = userCart.id;
      cartToken = userCart.token;
    } else if (userCart) {
      cartId = userCart.id;
      cartToken = userCart.token;
    } else if (usableGuest) {
      await db.cart.update({ where: { id: usableGuest.id }, data: { userId } });
      cartId = usableGuest.id;
      cartToken = usableGuest.token;
    } else {
      const c = await db.cart.create({ data: { token: randomToken(24), userId } });
      cartId = c.id;
      cartToken = c.token;
    }
  } else if (usableGuest) {
    cartId = usableGuest.id;
    cartToken = usableGuest.token;
  } else {
    const c = await db.cart.create({ data: { token: randomToken(24) } });
    cartId = c.id;
    cartToken = c.token;
  }

  if (token !== cartToken) {
    jar.set(CART_COOKIE, cartToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 60,
    });
  }
  return db.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartInclude });
}

export function parseCustomization(raw: unknown): Customization | null {
  if (raw == null) return null;
  const parsed = customizationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type CartLine = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  colorName: string;
  colorHex: string;
  sizeLabel: string;
  quantity: number;
  savedForLater: boolean;
  imageUrl: string | null;
  garmentType: string;
  unitPriceCents: number;
  customizationCents: number;
  designFeeCents: number;
  lineTotalCents: number;
  method: "NONE" | "UPLOAD" | "DESIGN_REQUEST";
  details: string[];
  artworkUploadIds: string[];
  error?: string;
};

export type CartSummary = {
  lines: CartLine[];
  saved: CartLine[];
  count: number;
  subtotalCents: number;
};

export async function summarizeCart(cart: CartWithItems | null): Promise<CartSummary> {
  if (!cart) return { lines: [], saved: [], count: 0, subtotalCents: 0 };
  const settings = await getPricingSettings();
  const all: CartLine[] = cart.items.map((item) => {
    const p = item.product;
    const c = parseCustomization(item.customization);
    const img =
      p.images.find((i) => i.colorId === item.variant.colorId && i.kind === "PHOTO") ??
      p.images.find((i) => i.colorId === item.variant.colorId) ??
      p.images.find((i) => i.kind === "PHOTO") ??
      null;
    const details: string[] = [];
    const artworkUploadIds: string[] = [];
    if (c?.method === "UPLOAD") {
      for (const pl of c.placements) {
        const loc = p.printLocations.find((l) => l.id === pl.locationId);
        details.push(`${loc?.name ?? "Print"}: ${pl.uploadId ? "your artwork" : ""}${pl.uploadId && pl.text ? " + " : ""}${pl.text ? `“${pl.text}”` : ""}`);
        if (pl.uploadId) artworkUploadIds.push(pl.uploadId);
      }
      if (c.instructions) details.push(`Notes: ${c.instructions}`);
    } else if (c?.method === "DESIGN_REQUEST") {
      details.push(`Design request: “${c.request.description.slice(0, 120)}${c.request.description.length > 120 ? "…" : ""}”`);
      if (c.request.textToInclude) details.push(`Text: ${c.request.textToInclude}`);
    }
    let priced = { unitPriceCents: 0, customizationCents: 0, designFeeCents: 0, lineTotalCents: 0 };
    let error: string | undefined;
    try {
      priced = priceLine(p, item.variant, c, item.quantity, settings);
      if (p.status !== "PUBLISHED") error = "This item is no longer available.";
      else if (!item.variant.isAvailable) error = "This option is currently unavailable.";
      else if (item.variant.stock != null && item.variant.stock < item.quantity) error = `Only ${item.variant.stock} left in stock.`;
    } catch (e) {
      error = (e as Error).message;
    }
    return {
      id: item.id,
      productId: p.id,
      slug: p.slug,
      title: p.title,
      colorName: item.variant.color.name,
      colorHex: item.variant.color.hex,
      sizeLabel: item.variant.size.label,
      quantity: item.quantity,
      savedForLater: item.savedForLater,
      imageUrl: img?.url ?? null,
      garmentType: p.garmentType,
      ...priced,
      method: c?.method ?? "NONE",
      details,
      artworkUploadIds,
      error,
    };
  });
  const lines = all.filter((l) => !l.savedForLater);
  return {
    lines,
    saved: all.filter((l) => l.savedForLater),
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: lines.reduce((n, l) => n + (l.error ? 0 : l.lineTotalCents), 0),
  };
}
