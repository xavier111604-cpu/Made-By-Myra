import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const statics = ["", "/shop", "/customize", "/creations", "/about", "/contact", "/faq"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const }));
  try {
    const [products, categories] = await Promise.all([
      db.product.findMany({ where: { status: "PUBLISHED", isDemo: false }, select: { slug: true, updatedAt: true } }),
      db.category.findMany({ select: { slug: true } }),
    ]);
    return [
      ...statics,
      ...categories.map((c) => ({ url: `${base}/collections/${c.slug}` })),
      ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt })),
    ];
  } catch {
    return statics;
  }
}
