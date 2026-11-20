"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CartLine, CartSummary } from "@/lib/cart";
import { cn, formatMoney } from "@/lib/format";
import { removeCartItem, toggleSaveForLater, updateCartQuantity } from "@/actions/cart";
import { GarmentSilhouette } from "./garment-preview";
import { TruckIcon } from "./icons";

export function CartView({ summary, checkoutEnabled, shippingNote }: { summary: CartSummary; checkoutEnabled: boolean; shippingNote: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : (res.error ?? "Something went wrong"));
      router.refresh();
    });

  async function checkout() {
    setError(null);
    setRedirecting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountCode: code.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "We couldn't start checkout. Please try again.");
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setRedirecting(false);
    }
  }

  const hasErrors = summary.lines.some((l) => l.error);

  if (!summary.lines.length && !summary.saved.length) {
    return (
      <div className="rounded-3xl border border-dashed border-line p-14 text-center">
        <p className="heading-script text-3xl">Your bag is empty ♡</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/customize" className="btn-primary">Start customizing</Link>
          <Link href="/shop" className="btn-secondary">Browse the shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className={cn(pending && "opacity-60")}>
        <ul className="divide-y divide-line border-y border-line">
          {summary.lines.map((l) => (
            <Line key={l.id} l={l} run={run} />
          ))}
        </ul>
        {summary.saved.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">Saved for later</h2>
            <ul className="divide-y divide-line border-y border-line">
              {summary.saved.map((l) => (
                <Line key={l.id} l={l} run={run} saved />
              ))}
            </ul>
          </div>
        )}
      </div>

      <aside className="card h-fit p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          {summary.lines.map((l) => (
            <div key={l.id} className="flex justify-between gap-3 text-charcoal/70">
              <dt className="truncate">{l.title} × {l.quantity}</dt>
              <dd>{formatMoney(l.lineTotalCents)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-2 font-semibold">
            <dt>Subtotal</dt>
            <dd>{formatMoney(summary.subtotalCents)}</dd>
          </div>
        </dl>
        <p className="mt-3 flex gap-2 text-xs text-charcoal/60">
          <TruckIcon size={16} className="shrink-0" /> {shippingNote}
        </p>
        <p className="mt-1 text-xs text-charcoal/60">Shipping and any applicable taxes are added at checkout. Your discount is applied there too.</p>
        <div className="mt-4">
          <label htmlFor="promo" className="label">Promo code</label>
          <input id="promo" className="input uppercase" maxLength={40} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional" />
        </div>
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn-primary mt-5 w-full py-3.5" onClick={checkout} disabled={!checkoutEnabled || redirecting || hasErrors || !summary.lines.length}>
          {redirecting ? "Taking you to secure checkout…" : "Secure checkout"}
        </button>
        {!checkoutEnabled && <p className="mt-2 text-xs text-amber-800">Checkout isn&apos;t connected yet (Stripe keys missing).</p>}
        {hasErrors && <p className="mt-2 text-xs text-red-700">Please fix the highlighted items before checking out.</p>}
        <p className="mt-3 text-center text-xs text-charcoal/60">Payments are processed securely by Stripe. Guest checkout available.</p>
      </aside>
    </div>
  );
}

function Line({ l, run, saved }: { l: CartLine; run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void; saved?: boolean }) {
  return (
    <li className="flex gap-4 py-5">
      <Link href={`/products/${l.slug}`} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-cream sm:h-32 sm:w-28">
        {l.imageUrl ? <Image src={l.imageUrl} alt="" fill sizes="112px" className="object-cover" /> : <GarmentSilhouette type={l.garmentType} hex={l.colorHex} label={false} />}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3">
          <Link href={`/products/${l.slug}`} className="font-medium hover:text-gold">{l.title}</Link>
          <p className="font-semibold">{formatMoney(l.lineTotalCents)}</p>
        </div>
        <p className="text-sm text-charcoal/60">{l.colorName} · {l.sizeLabel}</p>
        <div className="mt-2 space-y-0.5 text-xs text-charcoal/70">
          <p>Item: {formatMoney(l.unitPriceCents)} each</p>
          {l.customizationCents > 0 && <p>Customization: {formatMoney(l.customizationCents)} each</p>}
          {l.designFeeCents > 0 && <p>Design service: {formatMoney(l.designFeeCents)}</p>}
          {l.details.map((d, i) => (
            <p key={i} className="truncate">{d}</p>
          ))}
        </div>
        {l.artworkUploadIds.length > 0 && (
          <div className="mt-2 flex gap-2">
            {l.artworkUploadIds.map((id) => (
              // Artwork thumbnails are served through the authorized file route
              // eslint-disable-next-line @next/next/no-img-element
              <img key={id} src={`/api/files/${id}`} alt="Your artwork" className="h-10 w-10 rounded-md border border-line bg-white object-contain" loading="lazy" />
            ))}
          </div>
        )}
        {l.error && <p className="mt-2 text-sm text-red-700">{l.error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          {!saved && (
            <div className="flex items-center rounded-full border border-line">
              <button className="px-3 py-1" aria-label="Decrease quantity" onClick={() => run(() => updateCartQuantity(l.id, l.quantity - 1))}>−</button>
              <span className="w-6 text-center">{l.quantity}</span>
              <button className="px-3 py-1" aria-label="Increase quantity" onClick={() => run(() => updateCartQuantity(l.id, l.quantity + 1))}>+</button>
            </div>
          )}
          <button className="underline-offset-2 hover:underline" onClick={() => run(() => toggleSaveForLater(l.id))}>
            {saved ? "Move to bag" : "Save for later"}
          </button>
          <button className="text-charcoal/60 underline-offset-2 hover:underline" onClick={() => run(() => removeCartItem(l.id))}>Remove</button>
        </div>
      </div>
    </li>
  );
}
