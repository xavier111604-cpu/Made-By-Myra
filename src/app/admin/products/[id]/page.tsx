import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ProductEditor, type EditorProduct } from "@/components/admin/product-editor";
import { ImageManager } from "@/components/admin/image-manager";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [p, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        colors: { orderBy: { sortOrder: "asc" } },
        sizes: { orderBy: { sortOrder: "asc" } },
        variants: true,
        printLocations: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();

  const product: EditorProduct = {
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    materials: p.materials ?? "",
    careInstructions: p.careInstructions ?? "",
    productionTime: p.productionTime ?? "",
    basePriceCents: p.basePriceCents,
    garmentType: p.garmentType,
    categoryId: p.categoryId,
    tags: p.tags,
    status: p.status,
    isFeatured: p.isFeatured,
    isCustomizable: p.isCustomizable,
    allowUpload: p.allowUpload,
    allowDesignRequest: p.allowDesignRequest,
    designRequestMode: p.designRequestMode,
    designFeeCents: p.designFeeCents,
    sizeChart: (p.sizeChart as EditorProduct["sizeChart"]) ?? null,
    colors: p.colors.map((c) => ({ key: c.id, id: c.id, name: c.name, hex: c.hex })),
    sizes: p.sizes.map((s) => ({ key: s.id, id: s.id, label: s.label, surchargeCents: s.surchargeCents })),
    variants: p.variants.map((v) => ({ colorKey: v.colorId, sizeKey: v.sizeId, stock: v.stock, priceOverrideCents: v.priceOverrideCents, isAvailable: v.isAvailable, sku: v.sku })),
    locations: p.printLocations.map((l) => ({ id: l.id, name: l.name, view: l.view, areaX: l.areaX, areaY: l.areaY, areaW: l.areaW, areaH: l.areaH, widthIn: l.widthIn, heightIn: l.heightIn, priceCents: l.priceCents })),
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading-script text-5xl">{p.title}</h1>
        <Link href={`/products/${p.slug}`} target="_blank" className="btn-secondary btn-sm">Preview on store ↗</Link>
      </div>
      <ImageManager
        productId={p.id}
        colors={p.colors.map((c) => ({ id: c.id, name: c.name }))}
        images={p.images.map((i) => ({ id: i.id, url: i.url, colorId: i.colorId, view: i.view, kind: i.kind, alt: i.alt ?? "", sortOrder: i.sortOrder }))}
      />
      <ProductEditor categories={categories} product={product} />
    </div>
  );
}
