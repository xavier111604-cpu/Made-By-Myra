import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cardInclude, toCard } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";

export default async function WishlistPage() {
  const user = await requireUser();
  const items = await db.wishlistItem.findMany({
    where: { userId: user.id, product: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    include: { product: { include: cardInclude } },
  });
  const ids = new Set(items.map((i) => i.productId));
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Your wishlist</h2>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-charcoal/60">
          Tap the heart on any product to save it here. <Link href="/shop" className="underline">Browse the shop</Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
          {items.map((i) => <ProductCard key={i.productId} p={toCard(i.product, ids)} />)}
        </div>
      )}
    </div>
  );
}
