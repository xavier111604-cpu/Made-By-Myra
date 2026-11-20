import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ProductEditor } from "@/components/admin/product-editor";

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <div className="space-y-6">
      <h1 className="heading-script text-5xl">New product</h1>
      <ProductEditor categories={categories} />
    </div>
  );
}
