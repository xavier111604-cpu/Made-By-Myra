"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteObject, publicUrl } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "./cart";

const VIEWS = ["FRONT", "BACK", "LEFT", "RIGHT", "DETAIL", "LIFESTYLE"] as const;
const GARMENTS = ["TSHIRT", "LONGSLEEVE", "HOODIE", "CREWNECK", "SWEATPANTS", "SHORTS", "TOTE", "OTHER"] as const;
const cents = z.number().int().min(0).max(10_000_00);

const productSchema = z.object({
  id: z.string().max(40).optional(),
  title: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().min(1).max(8000),
  materials: z.string().trim().max(2000).optional(),
  careInstructions: z.string().trim().max(2000).optional(),
  productionTime: z.string().trim().max(200).optional(),
  basePriceCents: cents,
  garmentType: z.enum(GARMENTS),
  categoryId: z.string().max(40).nullable(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(30),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]),
  isFeatured: z.boolean(),
  isCustomizable: z.boolean(),
  allowUpload: z.boolean(),
  allowDesignRequest: z.boolean(),
  designRequestMode: z.enum(["FIXED_FEE", "QUOTE"]),
  designFeeCents: cents.nullable(),
  sizeChart: z.object({ columns: z.array(z.string().max(40)).max(10), rows: z.array(z.array(z.string().max(40)).max(10)).max(20) }).nullable(),
  colors: z.array(z.object({ key: z.string().max(40), id: z.string().max(40).optional(), name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).min(1).max(30),
  sizes: z.array(z.object({ key: z.string().max(40), id: z.string().max(40).optional(), label: z.string().trim().min(1).max(20), surchargeCents: z.number().int().min(-100000).max(100000) })).min(1).max(20),
  variants: z.array(
    z.object({
      colorKey: z.string().max(40),
      sizeKey: z.string().max(40),
      stock: z.number().int().min(0).max(100000).nullable(),
      priceOverrideCents: cents.nullable(),
      isAvailable: z.boolean(),
      sku: z.string().trim().max(60).nullable(),
    }),
  ),
  locations: z.array(
    z.object({
      id: z.string().max(40).optional(),
      name: z.string().trim().min(1).max(60),
      view: z.enum(VIEWS),
      areaX: z.number().min(0).max(100),
      areaY: z.number().min(0).max(100),
      areaW: z.number().min(1).max(100),
      areaH: z.number().min(1).max(100),
      widthIn: z.number().min(0.5).max(60),
      heightIn: z.number().min(0.5).max(60),
      priceCents: cents,
    }),
  ).max(12),
});

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `${i?.path.join(" › ") || "Form"}: ${i?.message}` };
  }
  const d = parsed.data;
  const slug = slugify(d.slug || d.title) || `product-${Date.now()}`;
  const clash = await db.product.findFirst({ where: { slug, NOT: d.id ? { id: d.id } : undefined } });
  if (clash) return { ok: false, error: "Another product already uses that URL slug. Please change the title or slug." };

  const base = {
    title: d.title,
    slug,
    description: d.description,
    materials: d.materials || null,
    careInstructions: d.careInstructions || null,
    productionTime: d.productionTime || null,
    basePriceCents: d.basePriceCents,
    garmentType: d.garmentType,
    categoryId: d.categoryId || null,
    tags: d.tags.filter(Boolean),
    status: d.status,
    isFeatured: d.isFeatured,
    isCustomizable: d.isCustomizable,
    allowUpload: d.allowUpload,
    allowDesignRequest: d.allowDesignRequest,
    designRequestMode: d.designRequestMode,
    designFeeCents: d.designFeeCents,
    sizeChart: d.sizeChart ? (d.sizeChart as Prisma.InputJsonValue) : Prisma.DbNull,
  };

  try {
    const id = await db.$transaction(async (tx) => {
      const product = d.id ? await tx.product.update({ where: { id: d.id }, data: base }) : await tx.product.create({ data: base });
      const pid = product.id;

      // Colors
      const keepColorIds = d.colors.filter((c) => c.id).map((c) => c.id!);
      await tx.productColor.deleteMany({ where: { productId: pid, id: { notIn: keepColorIds } } });
      const colorMap = new Map<string, string>();
      for (const [i, c] of d.colors.entries()) {
        const row = c.id
          ? await tx.productColor.update({ where: { id: c.id }, data: { name: c.name, hex: c.hex, sortOrder: i } })
          : await tx.productColor.create({ data: { productId: pid, name: c.name, hex: c.hex, sortOrder: i } });
        colorMap.set(c.key, row.id);
      }

      // Sizes
      const keepSizeIds = d.sizes.filter((s) => s.id).map((s) => s.id!);
      await tx.productSize.deleteMany({ where: { productId: pid, id: { notIn: keepSizeIds } } });
      const sizeMap = new Map<string, string>();
      for (const [i, s] of d.sizes.entries()) {
        const row = s.id
          ? await tx.productSize.update({ where: { id: s.id }, data: { label: s.label, surchargeCents: s.surchargeCents, sortOrder: i } })
          : await tx.productSize.create({ data: { productId: pid, label: s.label, surchargeCents: s.surchargeCents, sortOrder: i } });
        sizeMap.set(s.key, row.id);
      }

      // Variants (one per color × size)
      const keepVariantIds: string[] = [];
      for (const v of d.variants) {
        const colorId = colorMap.get(v.colorKey);
        const sizeId = sizeMap.get(v.sizeKey);
        if (!colorId || !sizeId) continue;
        const row = await tx.productVariant.upsert({
          where: { productId_colorId_sizeId: { productId: pid, colorId, sizeId } },
          update: { stock: v.stock, priceOverrideCents: v.priceOverrideCents, isAvailable: v.isAvailable, sku: v.sku || null },
          create: { productId: pid, colorId, sizeId, stock: v.stock, priceOverrideCents: v.priceOverrideCents, isAvailable: v.isAvailable, sku: v.sku || null },
        });
        keepVariantIds.push(row.id);
      }
      await tx.productVariant.deleteMany({ where: { productId: pid, id: { notIn: keepVariantIds } } });

      // Print locations
      const keepLocIds = d.locations.filter((l) => l.id).map((l) => l.id!);
      await tx.printLocation.deleteMany({ where: { productId: pid, id: { notIn: keepLocIds } } });
      for (const [i, l] of d.locations.entries()) {
        const { id: locId, ...rest } = l;
        if (locId) await tx.printLocation.update({ where: { id: locId }, data: { ...rest, sortOrder: i } });
        else await tx.printLocation.create({ data: { ...rest, productId: pid, sortOrder: i } });
      }
      return pid;
    });
    revalidatePath("/admin/products");
    revalidatePath(`/products/${slug}`);
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Couldn't save the product. If you changed SKUs, make sure each SKU is unique." };
  }
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = z.string().max(40).parse(formData.get("id"));
  const images = await db.productImage.findMany({ where: { productId: id } });
  await db.product.delete({ where: { id } });
  await Promise.all(images.map((i) => deleteObject(i.key, true).catch(() => {})));
  revalidatePath("/admin/products");
}

const imageSchema = z.object({
  productId: z.string().max(40),
  uploadId: z.string().max(40),
  colorId: z.string().max(40).nullable(),
  view: z.enum(VIEWS),
  kind: z.enum(["PHOTO", "MOCKUP"]),
  alt: z.string().trim().max(200).optional(),
});

export async function addProductImage(input: z.input<typeof imageSchema>): Promise<ActionResult> {
  await requireAdmin();
  const d = imageSchema.parse(input);
  const up = await db.upload.findUnique({ where: { id: d.uploadId } });
  if (!up || up.purpose !== "PRODUCT_IMAGE" || up.status !== "READY" || !up.isPublic) return { ok: false, error: "Image couldn't be verified." };
  const count = await db.productImage.count({ where: { productId: d.productId } });
  await db.productImage.create({
    data: { productId: d.productId, url: publicUrl(up.key), key: up.key, colorId: d.colorId, view: d.view, kind: d.kind, alt: d.alt || null, sortOrder: count },
  });
  revalidatePath(`/admin/products/${d.productId}`);
  return { ok: true };
}

export async function updateProductImage(input: { id: string; colorId: string | null; view: string; kind: string; alt?: string; sortOrder?: number }): Promise<ActionResult> {
  await requireAdmin();
  const d = z
    .object({ id: z.string().max(40), colorId: z.string().max(40).nullable(), view: z.enum(VIEWS), kind: z.enum(["PHOTO", "MOCKUP"]), alt: z.string().max(200).optional(), sortOrder: z.number().int().min(0).max(999).optional() })
    .parse(input);
  const img = await db.productImage.update({ where: { id: d.id }, data: { colorId: d.colorId, view: d.view, kind: d.kind, alt: d.alt ?? null, sortOrder: d.sortOrder } });
  revalidatePath(`/admin/products/${img.productId}`);
  return { ok: true };
}

export async function deleteProductImage(id: string): Promise<ActionResult> {
  await requireAdmin();
  const img = await db.productImage.delete({ where: { id: z.string().max(40).parse(id) } });
  await deleteObject(img.key, true).catch(() => {});
  revalidatePath(`/admin/products/${img.productId}`);
  return { ok: true };
}

// ── Categories ──

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const d = z
    .object({
      id: z.string().max(40).optional().or(z.literal("")),
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(500).optional(),
      imageUrl: z.string().trim().max(500).optional(),
      sortOrder: z.coerce.number().int().min(0).max(999).default(0),
    })
    .parse(Object.fromEntries(formData));
  const data = {
    name: d.name,
    description: d.description || null,
    imageUrl: d.imageUrl || null,
    sortOrder: d.sortOrder,
    showOnHome: formData.get("showOnHome") === "on",
    isSeasonal: formData.get("isSeasonal") === "on",
  };
  if (d.id) await db.category.update({ where: { id: d.id }, data });
  else await db.category.create({ data: { ...data, slug: slugify(d.name) || `collection-${Date.now()}` } });
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  await db.category.delete({ where: { id: z.string().max(40).parse(formData.get("id")) } });
  revalidatePath("/admin/categories");
}

export async function adjustStock(formData: FormData) {
  await requireAdmin();
  const variantId = z.string().max(40).parse(formData.get("variantId"));
  const change = z.coerce.number().int().min(-10000).max(10000).parse(formData.get("change"));
  const v = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  await db.productVariant.update({ where: { id: variantId }, data: { stock: Math.max(0, (v.stock ?? 0) + change) } });
  await db.inventoryLog.create({ data: { variantId, change, reason: "Manual adjustment" } });
  revalidatePath(`/admin/products/${v.productId}`);
}
