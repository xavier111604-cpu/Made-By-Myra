"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BagIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "./icons";
import { cn, formatMoney } from "@/lib/format";
import type { CartSummary } from "@/lib/cart";
import { removeCartItem, toggleSaveForLater, updateCartQuantity } from "@/actions/cart";
import { GarmentSilhouette } from "./garment-preview";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/customize", label: "Customize Your Own" },
  { href: "/creations", label: "Our Creations" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

export function openCartDrawer() {
  window.dispatchEvent(new Event("mbm:cart-open"));
}

export function SiteHeader({ cart, user }: { cart: CartSummary; user: { name: string | null; role: string } | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const open = () => setCartOpen(true);
    window.addEventListener("mbm:cart-open", open);
    return () => window.removeEventListener("mbm:cart-open", open);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4 md:h-20">
        <button className="btn-ghost -ml-3 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>
        <Link href="/" className="shrink-0" aria-label="Made by Myra — home">
          <Image src="/brand/logo-wordmark.png" alt="Made by Myra" width={140} height={78} priority className="h-12 w-auto md:h-14" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="link-gold" aria-current={isActive(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-0.5">
          <button className="btn-ghost" onClick={() => setSearchOpen(true)} aria-label="Search">
            <SearchIcon />
          </button>
          <Link href={user ? (user.role === "ADMIN" ? "/admin" : "/account") : "/login"} className="btn-ghost hidden sm:inline-flex" aria-label="Account">
            <UserIcon />
          </Link>
          <Link href="/account/wishlist" className="btn-ghost hidden sm:inline-flex" aria-label="Wishlist">
            <HeartIcon />
          </Link>
          <button className="btn-ghost relative" onClick={() => setCartOpen(true)} aria-label={`Shopping bag, ${cart.count} items`}>
            <BagIcon />
            {cart.count > 0 && (
              <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-blush-dusty px-1 text-[11px] font-semibold text-charcoal">
                {cart.count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div className="absolute inset-x-0 top-full z-50 animate-fade-in border-b border-line bg-white shadow-soft">
          <form action="/shop" className="container-page flex items-center gap-3 py-4" role="search">
            <SearchIcon className="text-charcoal/50" />
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input id="site-search" name="q" autoFocus placeholder="Search hoodies, tote bags, gifts…" className="input border-0 focus:ring-0" />
            <button type="button" className="btn-ghost" onClick={() => setSearchOpen(false)} aria-label="Close search">
              <CloseIcon />
            </button>
          </form>
        </div>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-charcoal/30 animate-fade-in" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-sm flex-col bg-white p-6 shadow-lift">
            <div className="mb-8 flex items-center justify-between">
              <span className="heading-script text-3xl">Made by Myra ♡</span>
              <button className="btn-ghost" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <CloseIcon />
              </button>
            </div>
            <nav className="flex flex-col gap-1 text-lg" aria-label="Mobile">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className={cn("rounded-xl px-3 py-3 hover:bg-cream", isActive(n.href) && "bg-blush/50")}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-6 text-sm">
              <Link href={user ? "/account" : "/login"} className="flex items-center gap-2 px-3 py-2">
                <UserIcon /> {user ? "My account" : "Sign in / Create account"}
              </Link>
              <Link href="/account/wishlist" className="flex items-center gap-2 px-3 py-2">
                <HeartIcon /> Wishlist
              </Link>
              {user?.role === "ADMIN" && (
                <Link href="/admin" className="px-3 py-2 font-semibold text-gold">
                  Owner dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} />
    </header>
  );
}

function CartDrawer({ open, onClose, cart }: { open: boolean; onClose: () => void; cart: CartSummary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.ok ? null : (res.error ?? "Something went wrong"));
      router.refresh();
    });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="absolute inset-0 animate-fade-in bg-charcoal/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in flex-col bg-white shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="heading-script text-3xl">Your bag</h2>
          <button ref={closeRef} className="btn-ghost" onClick={onClose} aria-label="Close bag">
            <CloseIcon />
          </button>
        </div>
        <div className={cn("flex-1 overflow-y-auto px-6 py-4", pending && "opacity-60")}>
          {cart.lines.length === 0 ? (
            <div className="py-16 text-center">
              <p className="heading-script text-2xl">Your bag is empty ♡</p>
              <Link href="/shop" onClick={onClose} className="btn-primary mt-6">
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex gap-4 py-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream">
                    {l.imageUrl ? (
                      <Image src={l.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                    ) : (
                      <GarmentSilhouette type={l.garmentType} hex={l.colorHex} label={false} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{l.title}</p>
                    <p className="text-charcoal/60">
                      {l.colorName} · {l.sizeLabel}
                    </p>
                    {l.details.slice(0, 2).map((d, i) => (
                      <p key={i} className="truncate text-xs text-charcoal/60">{d}</p>
                    ))}
                    {l.error && <p className="text-xs text-red-700">{l.error}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center rounded-full border border-line">
                        <button className="px-2.5 py-1" aria-label="Decrease quantity" onClick={() => run(() => updateCartQuantity(l.id, l.quantity - 1))}>
                          −
                        </button>
                        <span className="w-6 text-center" aria-live="polite">{l.quantity}</span>
                        <button className="px-2.5 py-1" aria-label="Increase quantity" onClick={() => run(() => updateCartQuantity(l.id, l.quantity + 1))}>
                          +
                        </button>
                      </div>
                      <button className="text-xs underline-offset-2 hover:underline" onClick={() => run(() => toggleSaveForLater(l.id))}>
                        Save for later
                      </button>
                      <button className="text-xs text-charcoal/60 hover:underline" onClick={() => run(() => removeCartItem(l.id))}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(l.lineTotalCents)}</p>
                </li>
              ))}
            </ul>
          )}
          {cart.saved.length > 0 && <p className="mt-4 text-xs text-charcoal/60">{cart.saved.length} item(s) saved for later — see your bag page.</p>}
          {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        </div>
        {cart.lines.length > 0 && (
          <div className="border-t border-line px-6 py-5">
            <div className="mb-1 flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
            <p className="mb-4 text-xs text-charcoal/60">Shipping, taxes and discounts are calculated at checkout.</p>
            <Link href="/cart" onClick={onClose} className="btn-primary w-full">
              View bag & checkout
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
