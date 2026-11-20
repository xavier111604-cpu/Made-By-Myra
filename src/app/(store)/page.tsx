import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getHome } from "@/lib/content";
import { featuredProducts } from "@/lib/catalog";
import { ProductCard, Stars } from "@/components/product-card";
import { HeroIllustration } from "@/components/hero-illustration";
import { FloatingHearts, HeartDoodle, ScriptHeading } from "@/components/decor";
import { GiftIcon, PencilIcon, ShirtIcon, SparkleIcon } from "@/components/icons";
import { NewsletterForm } from "@/components/newsletter-form";
import { Reveal } from "@/components/reveal";
import { GarmentSilhouette } from "@/components/garment-preview";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const CATEGORY_FALLBACK: Record<string, { type: string; hex: string }> = {
  "custom-t-shirts": { type: "TSHIRT", hex: "#F6DCE0" },
  "hoodies-sweatshirts": { type: "HOODIE", hex: "#E8E4DE" },
  "sweatpants-bottoms": { type: "SWEATPANTS", hex: "#C9D3C2" },
  "tote-bags-accessories": { type: "TOTE", hex: "#FFF6E8" },
  "personalized-gifts": { type: "OTHER", hex: "#EBC2CA" },
  "ready-to-shop": { type: "TSHIRT", hex: "#302A29" },
};

export default async function HomePage() {
  const [home, categories, featured, reviews] = await Promise.all([
    getHome(),
    db.category.findMany({ where: { showOnHome: true }, orderBy: [{ isSeasonal: "desc" }, { sortOrder: "asc" }] }),
    featuredProducts(8),
    db.review.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } }, product: { select: { title: true, slug: true } } },
    }),
  ]);

  return (
    <>
      {/* Promo banner */}
      {home.promo.enabled && home.promo.text && (
        <Link href={home.promo.link || "/shop"} className="block bg-cream py-3 text-center text-sm font-medium text-gold hover:underline">
          {home.promo.text}
        </Link>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <FloatingHearts />
        <div className="container-page grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div className="animate-fade-up">
            <ScriptHeading as="h1" brush className="text-6xl md:text-7xl">
              {home.heroHeading}
            </ScriptHeading>
            <p className="mt-6 max-w-md text-lg text-charcoal/80">{home.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/customize" className="btn-primary">
                Start Customizing
              </Link>
              <Link href="/creations" className="btn-secondary">
                Shop Our Creations
              </Link>
            </div>
          </div>
          <div className="relative aspect-[13/11] animate-fade-up overflow-hidden rounded-[2rem] shadow-lift [animation-delay:150ms]">
            {home.heroImageUrl ? (
              <Image src={home.heroImageUrl} alt={home.heroImageAlt} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            ) : (
              <HeroIllustration />
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container-page py-14" aria-labelledby="cat-heading">
          <div className="mb-8 text-center">
            <ScriptHeading className="text-5xl">
              <span id="cat-heading">Shop by Category</span>
            </ScriptHeading>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6">
            {categories.map((c, i) => {
              const fb = CATEGORY_FALLBACK[c.slug] ?? { type: "OTHER", hex: "#F6DCE0" };
              return (
                <Reveal key={c.id} delay={i * 60}>
                  <Link href={`/collections/${c.slug}`} className="group block">
                    <div className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-line bg-cream transition-shadow group-hover:shadow-lift">
                      {c.imageUrl ? (
                        <Image src={c.imageUrl} alt="" fill sizes="(min-width:768px) 33vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="h-full p-6 transition-transform duration-500 group-hover:scale-105">
                          <GarmentSilhouette type={fb.type} hex={fb.hex} label={false} />
                        </div>
                      )}
                      {c.isSeasonal && <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-semibold text-white">Seasonal</span>}
                    </div>
                    <p className="mt-3 text-center font-medium transition-colors group-hover:text-gold">{c.name}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="bg-cream py-16" aria-labelledby="how-heading">
        <div className="container-page">
          <div className="mb-10 text-center">
            <ScriptHeading className="text-5xl">
              <span id="how-heading">How It Works</span>
            </ScriptHeading>
          </div>
          <ol className="grid gap-6 md:grid-cols-3">
            {[
              { Icon: ShirtIcon, title: "Pick Your Product", text: "Choose your apparel or accessory." },
              { Icon: PencilIcon, title: "Make It Yours", text: "Upload your artwork or describe your dream design." },
              { Icon: GiftIcon, title: "We Create It", text: "Your order is reviewed, customized, and made with care." },
            ].map(({ Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 100} as="li" className="card h-full p-7 text-center">
                  <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-blush text-charcoal">
                    <Icon size={26} />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gold">Step {i + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-charcoal/70">{text}</p>
              </Reveal>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link href="/customize" className="btn-primary">
              <SparkleIcon size={16} /> Start your custom piece
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="container-page py-16" aria-labelledby="featured-heading">
        <div className="mb-8 flex items-end justify-between gap-4">
          <ScriptHeading className="text-5xl">
            <span id="featured-heading">{home.featuredHeading}</span>
          </ScriptHeading>
          <Link href="/shop" className="link-gold text-sm font-medium">
            View all
          </Link>
        </div>
        {featured.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-10 text-center text-charcoal/60">New creations are on their way ♡</p>
        )}
      </section>

      {/* Reviews — only genuine, approved reviews from verified purchasers */}
      <section className="bg-cream py-16" aria-labelledby="reviews-heading">
        <div className="container-page">
          <div className="mb-8 text-center">
            <ScriptHeading className="text-5xl">
              <span id="reviews-heading">Kind Words</span>
            </ScriptHeading>
          </div>
          {reviews.length ? (
            <div className="grid gap-5 md:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r.id} className="card p-6">
                  <Stars value={r.rating} />
                  {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                  <blockquote className="mt-2 line-clamp-6 text-sm text-charcoal/80">{r.body}</blockquote>
                  <figcaption className="mt-4 text-xs text-charcoal/60">
                    {r.user.name?.split(" ")[0] || "Verified buyer"} · Verified purchase ·{" "}
                    <Link href={`/products/${r.product.slug}`} className="underline">
                      {r.product.title}
                    </Link>{" "}
                    · {formatDate(r.createdAt)}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-center text-charcoal/60">
              Reviews from our customers will appear here once they&apos;ve received their orders. <HeartDoodle className="inline text-blush-hover" size={16} />
            </p>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="container-page py-16">
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-line bg-white p-8 text-center shadow-soft md:p-12">
          <FloatingHearts />
          <ScriptHeading className="text-5xl">Stay in the loop</ScriptHeading>
          <p className="mx-auto mt-3 max-w-md text-charcoal/70">Be the first to hear about new products, updates and promotions.</p>
          <div className="mx-auto mt-6 max-w-md text-left">
            <NewsletterForm source="home" />
          </div>
        </div>
      </section>
    </>
  );
}
