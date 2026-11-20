import Link from "next/link";
import { filterOptions, searchProducts, type ShopFilters } from "@/lib/catalog";
import { ProductCard } from "./product-card";
import { dollarsToCents } from "@/lib/format";

type SP = Record<string, string | string[] | undefined>;

export function parseFilters(sp: SP, fixed: Partial<ShopFilters> = {}): ShopFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const sorts = ["featured", "price-asc", "price-desc", "newest", "best-selling"] as const;
  const sort = sorts.find((x) => x === s("sort")) ?? "featured";
  return {
    q: s("q") || undefined,
    category: s("category") || undefined,
    min: s("min") ? dollarsToCents(s("min")!) : undefined,
    max: s("max") ? dollarsToCents(s("max")!) : undefined,
    color: s("color") || undefined,
    size: s("size") || undefined,
    inStock: s("inStock") === "1",
    sort,
    ...fixed,
  };
}

export async function ShopView({ sp, fixed = {}, basePath, hideCategory = false }: { sp: SP; fixed?: Partial<ShopFilters>; basePath: string; hideCategory?: boolean }) {
  const f = parseFilters(sp, fixed);
  const [products, opts] = await Promise.all([searchProducts(f), filterOptions()]);
  const val = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const filters = (
    <form action={basePath} className="space-y-5 text-sm">
      {f.q && <input type="hidden" name="q" value={f.q} />}
      {!hideCategory && (
        <div>
          <label htmlFor="f-category" className="label">Category</label>
          <select id="f-category" name="category" defaultValue={val("category")} className="input">
            <option value="">All categories</option>
            {opts.categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      <fieldset>
        <legend className="label">Price</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="f-min">Minimum price</label>
          <input id="f-min" name="min" inputMode="decimal" placeholder="Min $" defaultValue={val("min")} className="input" />
          <span>–</span>
          <label className="sr-only" htmlFor="f-max">Maximum price</label>
          <input id="f-max" name="max" inputMode="decimal" placeholder="Max $" defaultValue={val("max")} className="input" />
        </div>
      </fieldset>
      {opts.colors.length > 0 && (
        <div>
          <label htmlFor="f-color" className="label">Color</label>
          <select id="f-color" name="color" defaultValue={val("color")} className="input">
            <option value="">Any color</option>
            {opts.colors.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      {opts.sizes.length > 0 && (
        <div>
          <label htmlFor="f-size" className="label">Size</label>
          <select id="f-size" name="size" defaultValue={val("size")} className="input">
            <option value="">Any size</option>
            {opts.sizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" name="inStock" value="1" defaultChecked={f.inStock} className="accent-[#E8B5C0]" /> Available now
      </label>
      <div>
        <label htmlFor="f-sort" className="label">Sort by</label>
        <select id="f-sort" name="sort" defaultValue={f.sort} className="input">
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="newest">Newest</option>
          <option value="best-selling">Best-selling</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary btn-sm flex-1">Apply</button>
        <Link href={basePath} className="btn-ghost btn-sm">Clear</Link>
      </div>
    </form>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
      <aside>
        <details className="card p-4 lg:hidden">
          <summary className="cursor-pointer font-medium">Filter & sort</summary>
          <div className="mt-4">{filters}</div>
        </details>
        <div className="sticky top-28 hidden lg:block">{filters}</div>
      </aside>
      <div>
        <p className="mb-4 text-sm text-charcoal/60" aria-live="polite">
          {products.length} {products.length === 1 ? "item" : "items"}
          {f.q ? ` for “${f.q}”` : ""}
        </p>
        {products.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-12 text-center">
            <p className="heading-script text-3xl">Nothing here yet ♡</p>
            <p className="mt-2 text-sm text-charcoal/60">Try a different search or clear your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
