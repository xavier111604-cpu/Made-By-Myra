import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { startingPrice } from "./pricing";
import { getSession } from "./auth";

export const cardInclude = {
  colors: { orderBy: { sortOrder: "asc" } },
  sizes: { orderBy: { sortOrder: "asc" } },
  variants: { select: { priceOverrideCents: true, stock: true, isAvailable: true, sizeId: true, colorId: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 4 },
  category: { select: { name: true, slug: true } },
  reviews: { where: { approved: true }, select: { rating: true } },
} satisfies Prisma.ProductInclude;

type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  startingPriceCents: number;
  colors: { name: string; hex: string }[];
  imageUrl: string | null;
  imageAlt: string;
  garmentType: string;
  rating: { avg: number; count: number } | null;
  isCustomizable: boolean;
  isDemo: boolean;
  inStock: boolean;
  wishlisted: boolean;
};

export function toCard(p: CardProduct, wishlist: Set<string>): ProductCardData {
  const photo = p.images.find((i) => i.kind === "PHOTO") ?? p.images[0];
  const count = p.reviews.length;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description.slice(0, 220),
    startingPriceCents: startingPrice(p),
    colors: p.colors.map((c) => ({ name: c.name, hex: c.hex })),
    imageUrl: photo?.url ?? null,
    imageAlt: photo?.alt ?? p.title,
    garmentType: p.garmentType,
    rating: count ? { avg: p.reviews.reduce((s, r) => s + r.rating, 0) / count, count } : null,
    isCustomizable: p.isCustomizable,
    isDemo: p.isDemo,
    inStock: p.variants.some((v) => v.isAvailable && (v.stock == null || v.stock > 0)),
    wishlisted: wishlist.has(p.id),
  };
}

export async function wishlistIds() {
  const session = await getSession();
  if (!session?.user?.id) return new Set<string>();
  const rows = await db.wishlistItem.findMany({ where: { userId: session.user.id }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}

export type ShopFilters = {
  q?: string;
  category?: string;
  min?: number;
  max?: number;
  color?: string;
  size?: string;
  inStock?: boolean;
  customizable?: boolean;
  sort?: "featured" | "price-asc" | "price-desc" | "newest" | "best-selling";
};

export async function searchProducts(f: ShopFilters) {
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED" };
  const and: Prisma.ProductWhereInput[] = [];
  if (f.q) {
    const q = f.q.trim().slice(0, 100);
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.category) and.push({ category: { slug: f.category } });
  if (f.color) and.push({ colors: { some: { name: { equals: f.color, mode: "insensitive" } } } });
  if (f.size) and.push({ sizes: { some: { label: { equals: f.size, mode: "insensitive" } } } });
  if (f.customizable !== undefined) and.push({ isCustomizable: f.customizable });
  if (f.inStock) and.push({ variants: { some: { isAvailable: true, OR: [{ stock: null }, { stock: { gt: 0 } }] } } });
  if (and.length) where.AND = and;

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    f.sort === "newest"
      ? [{ createdAt: "desc" }]
      : f.sort === "best-selling"
        ? [{ soldCount: "desc" }]
        : f.sort === "price-asc"
          ? [{ basePriceCents: "asc" }]
          : f.sort === "price-desc"
            ? [{ basePriceCents: "desc" }]
            : [{ isFeatured: "desc" }, { createdAt: "desc" }];

  const [products, wl] = await Promise.all([db.product.findMany({ where, orderBy, include: cardInclude, take: 120 }), wishlistIds()]);
  let cards = products.map((p) => toCard(p, wl));
  // Price filters use the real starting price (base + surcharges / variant overrides)
  if (f.min != null) cards = cards.filter((c) => c.startingPriceCents >= f.min!);
  if (f.max != null) cards = cards.filter((c) => c.startingPriceCents <= f.max!);
  if (f.sort === "price-asc") cards.sort((a, b) => a.startingPriceCents - b.startingPriceCents);
  if (f.sort === "price-desc") cards.sort((a, b) => b.startingPriceCents - a.startingPriceCents);
  return cards;
}

export async function featuredProducts(limit = 8) {
  const [products, wl] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED", isFeatured: true },
      include: cardInclude,
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    wishlistIds(),
  ]);
  return products.map((p) => toCard(p, wl));
}

export async function filterOptions() {
  const [categories, colors, sizes] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.productColor.findMany({ where: { product: { status: "PUBLISHED" } }, select: { name: true, hex: true }, distinct: ["name"] }),
    db.productSize.findMany({ where: { product: { status: "PUBLISHED" } }, select: { label: true }, distinct: ["label"] }),
  ]);
  const order = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
  sizes.sort((a, b) => (order.indexOf(a.label) + 1 || 99) - (order.indexOf(b.label) + 1 || 99));
  return { categories, colors, sizes: sizes.map((s) => s.label) };
}
