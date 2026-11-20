import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { deleteProduct } from "@/actions/admin-products";

export default async function AdminProducts() {
  await requireAdmin();
  const products = await db.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: { category: true, images: { take: 1, orderBy: { sortOrder: "asc" } }, variants: { select: { stock: true } } },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading-script text-5xl">Products</h1>
        <Link href="/admin/products/new" className="btn-primary btn-sm">+ New product</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="admin-table w-full min-w-[760px]">
          <thead><tr><th></th><th>Product</th><th>Category</th><th>Status</th><th>Price from</th><th>Stock</th><th>Sold</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => {
              const tracked = p.variants.filter((v) => v.stock != null);
              const stock = tracked.length ? tracked.reduce((s, v) => s + (v.stock ?? 0), 0) : null;
              return (
                <tr key={p.id}>
                  <td className="w-14">
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-cream">
                      {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                  </td>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="font-medium underline">{p.title}</Link>
                    <div className="mt-0.5 flex gap-1">
                      {p.isFeatured && <span className="chip py-0 text-[10px]">Featured</span>}
                      {p.isCustomizable && <span className="chip py-0 text-[10px]">Customizable</span>}
                      {p.isDemo && <span className="chip border-amber-300 py-0 text-[10px] text-amber-800">Demo</span>}
                    </div>
                  </td>
                  <td>{p.category?.name ?? "—"}</td>
                  <td>{p.status === "PUBLISHED" ? "Published" : p.status === "DRAFT" ? "Draft" : "Hidden"}</td>
                  <td>{formatMoney(p.basePriceCents)}</td>
                  <td>{stock == null ? "Made to order" : stock}</td>
                  <td>{p.soldCount}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/products/${p.slug}`} className="mr-3 text-xs underline" target="_blank">View</Link>
                    <form action={deleteProduct} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-xs text-red-700 underline" title="Deletes the product permanently. Past orders keep their details.">Delete</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-charcoal/60">No products yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
