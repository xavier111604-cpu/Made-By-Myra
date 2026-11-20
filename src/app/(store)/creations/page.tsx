import type { Metadata } from "next";
import { ShopView } from "@/components/shop-view";
import { ScriptHeading } from "@/components/decor";

export const metadata: Metadata = { title: "Our Creations", description: "Ready-to-shop designs made by Myra." };

export default async function CreationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="container-page py-10">
      <ScriptHeading as="h1" brush className="text-6xl">Our Creations</ScriptHeading>
      <p className="mt-4 max-w-2xl text-charcoal/70">Ready-to-shop designs, made with care. Pick your color and size and we&apos;ll take it from there.</p>
      <div className="mt-8">
        <ShopView sp={await searchParams} fixed={{ customizable: false }} basePath="/creations" />
      </div>
    </div>
  );
}
