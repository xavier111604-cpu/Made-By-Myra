import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteCategory, saveCategory } from "@/actions/admin-products";
import { ImageUrlField } from "@/components/admin/image-url-field";

export default async function CategoriesPage() {
  await requireAdmin();
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <div className="space-y-6">
      <h1 className="heading-script text-5xl">Categories & collections</h1>
      <p className="text-sm text-charcoal/70">Categories appear in the shop filters and as cards on the homepage. Mark one as <em>seasonal</em> to highlight a seasonal collection.</p>
      <div className="grid gap-5 lg:grid-cols-2">
        {categories.map((c) => (
          <CategoryForm key={c.id} c={c} count={c._count.products} />
        ))}
        <CategoryForm />
      </div>
    </div>
  );
}

function CategoryForm({ c, count }: { c?: { id: string; name: string; slug: string; description: string | null; imageUrl: string | null; sortOrder: number; showOnHome: boolean; isSeasonal: boolean }; count?: number }) {
  return (
    <div className="card p-5">
      <form action={saveCategory} className="space-y-3 text-sm">
        <h2 className="font-semibold">{c ? c.name : "New category"}</h2>
        {c && <p className="text-xs text-charcoal/60">/collections/{c.slug} · {count} product(s)</p>}
        <input type="hidden" name="id" value={c?.id ?? ""} />
        <label className="block"><span className="label">Name</span><input name="name" defaultValue={c?.name} className="input" required /></label>
        <label className="block"><span className="label">Description</span><textarea name="description" defaultValue={c?.description ?? ""} className="input min-h-16" /></label>
        <ImageUrlField name="imageUrl" initial={c?.imageUrl} label="Card image" />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" name="showOnHome" defaultChecked={c?.showOnHome ?? true} className="accent-[#E8B5C0]" /> Show on homepage</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="isSeasonal" defaultChecked={c?.isSeasonal} className="accent-[#E8B5C0]" /> Seasonal</label>
          <label className="flex items-center gap-2">Order <input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="input w-20 py-1" /></label>
        </div>
        <button className="btn-primary btn-sm">{c ? "Save" : "Create category"}</button>
      </form>
      {c && (
        <form action={deleteCategory} className="mt-2">
          <input type="hidden" name="id" value={c.id} />
          <button className="text-xs text-red-700 underline">Delete category (products stay, uncategorized)</button>
        </form>
      )}
    </div>
  );
}
