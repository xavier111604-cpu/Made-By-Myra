import type { Metadata } from "next";
import { ShopView } from "@/components/shop-view";
import { ScriptHeading } from "@/components/decor";

export const metadata: Metadata = { title: "Shop", description: "Shop custom apparel, accessories and personalized gifts." };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="container-page py-10">
      <ScriptHeading as="h1" brush className="mb-8 text-6xl">Shop</ScriptHeading>
      <ShopView sp={sp} basePath="/shop" />
    </div>
  );
}
