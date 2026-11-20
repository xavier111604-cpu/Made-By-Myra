import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPricingSettings } from "@/lib/content";
import { designFeeFor, startingPrice } from "@/lib/pricing";
import { formatDate, formatMoney, siteUrl } from "@/lib/utils";
import { ProductConfigurator, type ConfigProduct } from "@/components/customizer/product-configurator";
import { Stars } from "@/components/product-card";
import { ReviewForm } from "@/components/review-form";
import { WishlistButton } from "@/components/wishlist-button";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { sortOrder: "asc" } },
      variants: true,
      images: { orderBy: { sortOrder: "asc" } },
      printLocations: { orderBy: { sortOrder: "asc" } },
      reviews: { where: { approved: true }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p || p.status !== "PUBLISHED") return {};
  const img = p.images.find((i) => i.kind === "PHOTO");
  return {
    title: p.title,
    description: p.description.slice(0, 160),
    openGraph: { title: p.title, description: p.description.slice(0, 160), images: img ? [img.url] : undefined },
    alternates: { canonical: `/products/${p.slug}` },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p, user, settings] = await Promise.all([load(slug), getCurrentUser(), getPricingSettings()]);
  if (!p) notFound();
  if (p.status !== "PUBLISHED" && user?.role !== "ADMIN") notFound();

  const photos = p.images.filter((i) => i.kind === "PHOTO");
  const rating = p.reviews.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : null;

  // Verified purchaser who hasn't reviewed yet?
  let reviewableItemId: string | null = null;
  let wishlisted = false;
  if (user) {
    const [item, existing, wl] = await Promise.all([
      db.orderItem.findFirst({
        where: { productId: p.id, order: { userId: user.id, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } } },
        select: { id: true },
      }),
      db.review.findUnique({ where: { userId_productId: { userId: user.id, productId: p.id } } }),
      db.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId: p.id } } }),
    ]);
    if (item && !existing) reviewableItemId = item.id;
    wishlisted = Boolean(wl);
  }

  const config: ConfigProduct = {
    id: p.id,
    title: p.title,
    garmentType: p.garmentType,
    basePriceCents: p.basePriceCents,
    isCustomizable: p.isCustomizable,
    allowUpload: p.allowUpload,
    allowDesignRequest: p.allowDesignRequest,
    designRequestMode: p.designRequestMode,
    designFeeCents: designFeeFor(p, settings),
    colors: p.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
    sizes: p.sizes.map((s) => ({ id: s.id, label: s.label, surchargeCents: s.surchargeCents })),
    variants: p.variants.map((v) => ({ colorId: v.colorId, sizeId: v.sizeId, priceOverrideCents: v.priceOverrideCents, stock: v.stock, isAvailable: v.isAvailable })),
    images: p.images.map((i) => ({ url: i.url, colorId: i.colorId, view: i.view, kind: i.kind, alt: i.alt })),
    locations: p.printLocations.map((l) => ({
      id: l.id,
      name: l.name,
      view: l.view,
      areaX: l.areaX,
      areaY: l.areaY,
      areaW: l.areaW,
      areaH: l.areaH,
      priceCents: l.priceCents,
      widthIn: l.widthIn,
      heightIn: l.heightIn,
    })),
    sizeChart: (p.sizeChart as ConfigProduct["sizeChart"]) ?? null,
    materials: p.materials,
    careInstructions: p.careInstructions,
    productionTime: p.productionTime,
  };

  const from = startingPrice(p);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description,
    image: photos.map((i) => i.url),
    sku: p.id,
    brand: { "@type": "Brand", name: "Made by Myra" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: (from / 100).toFixed(2),
      url: siteUrl(`/products/${p.slug}`),
      availability: p.variants.some((v) => v.isAvailable && (v.stock == null || v.stock > 0)) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.toFixed(1), reviewCount: p.reviews.length } } : {}),
  };

  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="mb-6 text-xs text-charcoal/60" aria-label="Breadcrumb">
        <Link href="/shop" className="hover:underline">Shop</Link>
        {p.category && (
          <>
            {" / "}
            <Link href={`/collections/${p.category.slug}`} className="hover:underline">{p.category.name}</Link>
          </>
        )}
        {" / "}
        <span aria-current="page">{p.title}</span>
      </nav>

      {p.status !== "PUBLISHED" && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Owner preview — this product is not published.</p>}
      {p.isDemo && <p className="mb-4 rounded-xl bg-cream p-3 text-sm">This is a demonstration product created for testing. Replace it with your real products in the dashboard.</p>}

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">{p.title}</h1>
          <p className="mt-2 text-lg">From {formatMoney(from)}</p>
          {rating && (
            <a href="#reviews" className="mt-1 flex items-center gap-2 text-sm text-charcoal/70">
              <Stars value={rating} /> {p.reviews.length} review{p.reviews.length === 1 ? "" : "s"}
            </a>
          )}
        </div>
        <WishlistButton productId={p.id} initial={wishlisted} signedIn={Boolean(user)} slug={p.slug} />
      </div>

      <ProductConfigurator product={config} signedInEmail={user?.email ?? null} />

      <section className="mt-16 grid gap-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="heading-script mb-3 text-4xl">About this piece</h2>
          <p className="whitespace-pre-line text-charcoal/80">{p.description}</p>
        </div>
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {photos.slice(0, 4).map((img) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
                <Image src={img.url} alt={img.alt ?? p.title} fill sizes="(min-width:768px) 20vw, 45vw" className="object-cover" />
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="reviews" className="mt-16" aria-labelledby="reviews-h">
        <h2 id="reviews-h" className="heading-script mb-6 text-4xl">Reviews</h2>
        {p.reviews.length === 0 && <p className="text-charcoal/60">No reviews yet.</p>}
        <div className="grid gap-5 md:grid-cols-2">
          {p.reviews.map((r) => (
            <article key={r.id} className="card p-5">
              <div className="flex items-center justify-between">
                <Stars value={r.rating} />
                <span className="text-xs text-charcoal/60">{formatDate(r.createdAt)}</span>
              </div>
              {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
              <p className="mt-1 whitespace-pre-line text-sm text-charcoal/80">{r.body}</p>
              {r.photoUploadId && (
                // Review photos are approved by the owner and served through the authorized file route
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${r.photoUploadId}?review=1`} alt="Customer photo" className="mt-3 h-28 w-28 rounded-xl object-cover" loading="lazy" />
              )}
              <p className="mt-3 text-xs text-charcoal/60">{r.user.name?.split(" ")[0] || "Customer"} · Verified purchase</p>
            </article>
          ))}
        </div>
        {reviewableItemId && (
          <div className="mt-8 max-w-xl">
            <ReviewForm productId={p.id} />
          </div>
        )}
      </section>
    </div>
  );
}
