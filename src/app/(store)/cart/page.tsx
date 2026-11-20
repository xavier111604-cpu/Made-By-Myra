import type { Metadata } from "next";
import { findCart, summarizeCart } from "@/lib/cart";
import { db } from "@/lib/db";
import { stripeConfigured } from "@/lib/stripe";
import { ScriptHeading } from "@/components/decor";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function CartPage() {
  const summary = await summarizeCart(await findCart());
  const rates = await db.shippingRate.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="container-page py-10">
      <ScriptHeading as="h1" brush className="mb-8 text-6xl">Your bag</ScriptHeading>
      <CartView
        summary={summary}
        checkoutEnabled={stripeConfigured}
        shippingNote={
          rates.length
            ? rates.map((r) => `${r.name}: ${r.amountCents === 0 ? "Free" : `$${(r.amountCents / 100).toFixed(2)}`}${r.freeOverCents ? ` (free over $${(r.freeOverCents / 100).toFixed(0)})` : ""}`).join(" · ")
            : "Shipping options are shown at checkout."
        }
      />
    </div>
  );
}
