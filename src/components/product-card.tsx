"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon, HeartIcon, StarIcon } from "./icons";
import { GarmentSilhouette } from "./garment-preview";
import { cn, formatMoney } from "@/lib/format";
import { toggleWishlist } from "@/actions/cart";
import type { ProductCardData } from "@/lib/catalog";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex text-gold" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} filled={value >= n - 0.25} />
      ))}
    </span>
  );
}

export function ProductCard({ p }: { p: ProductCardData }) {
  const router = useRouter();
  const [saved, setSaved] = useState(p.wishlisted);
  const [quick, setQuick] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const res = await toggleWishlist(p.id);
      if (res.ok) setSaved(Boolean(res.data?.saved));
      else if (res.error.includes("sign in")) router.push(`/login?callbackUrl=/products/${p.slug}`);
      else setMsg(res.error);
    });

  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-cream transition-shadow duration-300 group-hover:shadow-lift">
        <Link href={`/products/${p.slug}`} aria-label={p.title}>
          {p.imageUrl ? (
            <Image
              src={p.imageUrl}
              alt={p.imageAlt}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <GarmentSilhouette type={p.garmentType} hex={p.colors[0]?.hex} className="transition-transform duration-500 group-hover:scale-[1.03]" />
          )}
        </Link>
        {p.isDemo && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Demo product</span>}
        <button
          onClick={toggle}
          aria-pressed={saved}
          aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-charcoal shadow-soft transition hover:scale-110 hover:text-blush-hover"
        >
          <HeartIcon filled={saved} className={cn(saved && "text-blush-hover")} />
        </button>
        <button
          onClick={() => setQuick(true)}
          className="absolute inset-x-3 bottom-3 translate-y-2 rounded-full bg-white/95 py-2 text-xs font-semibold opacity-0 shadow-soft transition-all duration-300 focus:translate-y-0 focus:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
        >
          Quick view
        </button>
      </div>
      <div className="mt-3 space-y-1 px-1">
        <Link href={`/products/${p.slug}`} className="block font-medium hover:text-gold">
          {p.title}
        </Link>
        <p className="text-sm text-charcoal/70">From {formatMoney(p.startingPriceCents)}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex -space-x-1" aria-label={`Available in ${p.colors.map((c) => c.name).join(", ")}`}>
            {p.colors.slice(0, 6).map((c) => (
              <span key={c.name} title={c.name} className="h-4 w-4 rounded-full border border-white ring-1 ring-line" style={{ background: c.hex }} />
            ))}
            {p.colors.length > 6 && <span className="pl-2 text-xs text-charcoal/60">+{p.colors.length - 6}</span>}
          </div>
          {p.rating && (
            <span className="flex items-center gap-1 text-xs text-charcoal/60">
              <Stars value={p.rating.avg} size={12} /> ({p.rating.count})
            </span>
          )}
        </div>
        {msg && <p className="text-xs text-red-700">{msg}</p>}
      </div>
      {quick && <QuickView p={p} onClose={() => setQuick(false)} />}
    </article>
  );
}

function QuickView({ p, onClose }: { p: ProductCardData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={`Quick view: ${p.title}`}>
      <div className="absolute inset-0 animate-fade-in bg-charcoal/30" onClick={onClose} />
      <div className="relative grid w-full max-w-3xl animate-fade-up gap-6 overflow-hidden rounded-3xl bg-white p-5 shadow-lift sm:grid-cols-2 sm:p-6">
        <button className="btn-ghost absolute right-3 top-3 z-10" onClick={onClose} aria-label="Close quick view" autoFocus>
          <CloseIcon />
        </button>
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-cream">
          {p.imageUrl ? <Image src={p.imageUrl} alt={p.imageAlt} fill sizes="400px" className="object-cover" /> : <GarmentSilhouette type={p.garmentType} hex={p.colors[0]?.hex} />}
        </div>
        <div className="flex flex-col">
          <h3 className="pr-8 text-xl font-semibold">{p.title}</h3>
          <p className="mt-1 text-lg">From {formatMoney(p.startingPriceCents)}</p>
          {p.rating && (
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Stars value={p.rating.avg} /> {p.rating.count} review{p.rating.count === 1 ? "" : "s"}
            </p>
          )}
          <p className="mt-4 line-clamp-5 text-sm text-charcoal/80">{p.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.colors.map((c) => (
              <span key={c.name} className="chip gap-1.5">
                <span className="h-3 w-3 rounded-full ring-1 ring-line" style={{ background: c.hex }} /> {c.name}
              </span>
            ))}
          </div>
          <Link href={`/products/${p.slug}`} className="btn-primary mt-auto w-full">
            {p.isCustomizable ? "Customize this item" : "View details"}
          </Link>
        </div>
      </div>
    </div>
  );
}
