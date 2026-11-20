import type { Metadata } from "next";
import { ShopView } from "@/components/shop-view";
import { ScriptHeading } from "@/components/decor";
import { PencilIcon, ShirtIcon, UploadIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Customize Your Own", description: "Upload your own artwork or describe your dream design." };

export default async function CustomizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl text-center">
        <ScriptHeading as="h1" brush className="text-6xl">Customize Your Own</ScriptHeading>
        <p className="mt-4 text-charcoal/70">Start by choosing a product below. Then pick a color and size, and either upload your own design or tell us your idea.</p>
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
          {[
            { Icon: ShirtIcon, t: "1. Choose a product" },
            { Icon: UploadIcon, t: "2. Upload your design" },
            { Icon: PencilIcon, t: "…or describe your idea" },
          ].map(({ Icon, t }) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-sm font-medium">
              <Icon className="text-gold" /> {t}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-12">
        <ShopView sp={await searchParams} fixed={{ customizable: true }} basePath="/customize" />
      </div>
    </div>
  );
}
