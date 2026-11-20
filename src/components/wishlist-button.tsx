"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon } from "./icons";
import { toggleWishlist } from "@/actions/cart";
import { cn } from "@/lib/format";

export function WishlistButton({ productId, initial, signedIn, slug }: { productId: string; initial: boolean; signedIn: boolean; slug: string }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      aria-pressed={saved}
      disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push(`/login?callbackUrl=/products/${slug}`);
        start(async () => {
          const res = await toggleWishlist(productId);
          if (res.ok) setSaved(Boolean(res.data?.saved));
        });
      }}
      className="btn-secondary btn-sm shrink-0"
    >
      <HeartIcon filled={saved} size={16} className={cn(saved && "text-blush-hover")} /> {saved ? "Saved" : "Save"}
    </button>
  );
}
