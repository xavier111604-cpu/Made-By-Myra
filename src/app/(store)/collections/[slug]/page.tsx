import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ShopView } from "@/components/shop-view";
import { ScriptHeading } from "@/components/decor";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await db.category.findUnique({ where: { slug } });
  return c ? { title: c.name, description: c.description ?? `Shop ${c.name} from Made by Myra.` } : {};
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await db.category.findUnique({ where: { slug } });
  if (!category) notFound();
  return (
    <div className="container-page py-10">
      <ScriptHeading as="h1" brush className="text-6xl">{category.name}</ScriptHeading>
      {category.description && <p className="mt-4 max-w-2xl text-charcoal/70">{category.description}</p>}
      <div className="mt-8">
        <ShopView sp={await searchParams} fixed={{ category: slug }} basePath={`/collections/${slug}`} hideCategory />
      </div>
    </div>
  );
}
