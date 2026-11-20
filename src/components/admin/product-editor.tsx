"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProduct, type ProductInput } from "@/actions/admin-products";
import { GarmentSilhouette } from "../garment-preview";
import { centsToDollars, cn, dollarsToCents } from "@/lib/format";

export type EditorProduct = Omit<ProductInput, "id" | "slug" | "materials" | "careInstructions" | "productionTime"> & {
  id?: string;
  slug?: string;
  materials: string;
  careInstructions: string;
  productionTime: string;
};

type Loc = EditorProduct["locations"][number];
const VIEWS = ["FRONT", "BACK", "LEFT", "RIGHT"] as const;
const GARMENTS = ["TSHIRT", "LONGSLEEVE", "HOODIE", "CREWNECK", "SWEATPANTS", "SHORTS", "TOTE", "OTHER"] as const;

const COLOR_PRESETS = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#1F1D1D" },
  { name: "Cream", hex: "#F4EBDD" },
  { name: "Light Pink", hex: "#F6D3DA" },
  { name: "Heather Gray", hex: "#B9B7B5" },
  { name: "Navy", hex: "#22304A" },
  { name: "Sage Green", hex: "#B5C1A6" },
];

const LOCATION_PRESETS: Record<string, Loc[]> = {
  top: [
    { name: "Front center", view: "FRONT", areaX: 34, areaY: 33, areaW: 32, areaH: 34, widthIn: 12, heightIn: 13, priceCents: 0 },
    { name: "Left chest", view: "FRONT", areaX: 57, areaY: 21, areaW: 12, areaH: 9, widthIn: 4, heightIn: 3.5, priceCents: 0 },
    { name: "Back center", view: "BACK", areaX: 33, areaY: 22, areaW: 34, areaH: 42, widthIn: 12, heightIn: 15, priceCents: 800 },
  ],
  SWEATPANTS: [
    { name: "Left leg", view: "FRONT", areaX: 56, areaY: 38, areaW: 14, areaH: 26, widthIn: 4, heightIn: 10, priceCents: 0 },
    { name: "Right leg", view: "FRONT", areaX: 30, areaY: 38, areaW: 14, areaH: 26, widthIn: 4, heightIn: 10, priceCents: 0 },
  ],
  SHORTS: [{ name: "Left leg", view: "FRONT", areaX: 56, areaY: 46, areaW: 18, areaH: 20, widthIn: 4, heightIn: 4, priceCents: 0 }],
  TOTE: [{ name: "Front center", view: "FRONT", areaX: 30, areaY: 45, areaW: 40, areaH: 36, widthIn: 10, heightIn: 10, priceCents: 0 }],
};

let tmp = 0;
const key = () => `tmp_${Date.now()}_${tmp++}`;

const EMPTY: EditorProduct = {
  title: "",
  description: "",
  materials: "",
  careInstructions: "",
  productionTime: "",
  basePriceCents: 2500,
  garmentType: "TSHIRT",
  categoryId: null,
  tags: [],
  status: "DRAFT",
  isFeatured: false,
  isCustomizable: true,
  allowUpload: true,
  allowDesignRequest: true,
  designRequestMode: "FIXED_FEE",
  designFeeCents: null,
  sizeChart: null,
  colors: [{ key: "c0", name: "White", hex: "#FFFFFF" }],
  sizes: ["S", "M", "L", "XL"].map((label) => ({ key: `s_${label}`, label, surchargeCents: 0 })),
  variants: [],
  locations: LOCATION_PRESETS.top,
};

export function ProductEditor({ categories, product }: { categories: { id: string; name: string }[]; product?: EditorProduct }) {
  const router = useRouter();
  const [p, setP] = useState<EditorProduct>(product ?? EMPTY);
  const [chartText, setChartText] = useState(() =>
    product?.sizeChart ? [product.sizeChart.columns, ...product.sizeChart.rows].map((r) => r.join(", ")).join("\n") : "",
  );
  const [previewView, setPreviewView] = useState<string>("FRONT");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof EditorProduct>(k: K, v: EditorProduct[K]) => setP((x) => ({ ...x, [k]: v }));

  // Variant matrix always covers every color × size
  const variants = useMemo(() => {
    const out: EditorProduct["variants"] = [];
    for (const c of p.colors)
      for (const s of p.sizes) {
        const existing = p.variants.find((v) => v.colorKey === c.key && v.sizeKey === s.key);
        out.push(existing ?? { colorKey: c.key, sizeKey: s.key, stock: null, priceOverrideCents: null, isAvailable: true, sku: null });
      }
    return out;
  }, [p.colors, p.sizes, p.variants]);
  const setVariant = (colorKey: string, sizeKey: string, patch: Partial<EditorProduct["variants"][number]>) =>
    set("variants", variants.map((v) => (v.colorKey === colorKey && v.sizeKey === sizeKey ? { ...v, ...patch } : v)));

  function save() {
    setMsg(null);
    let sizeChart: EditorProduct["sizeChart"] = null;
    const lines = chartText.split("\n").map((l) => l.split(",").map((c) => c.trim())).filter((r) => r.some(Boolean));
    if (lines.length >= 2) sizeChart = { columns: lines[0], rows: lines.slice(1) };
    start(async () => {
      const res = await saveProduct({ ...p, variants, sizeChart });
      if (res.ok) {
        setMsg({ ok: true, text: "Saved ♡" });
        if (!p.id && res.data?.id) router.push(`/admin/products/${res.data.id}`);
        else router.refresh();
      } else setMsg({ ok: false, text: res.error });
    });
  }

  const presetLocations = LOCATION_PRESETS[p.garmentType] ?? LOCATION_PRESETS.top;
  const previewHex = p.colors[0]?.hex ?? "#FFFFFF";

  return (
    <div className="space-y-6 pb-24">
      <Section title="Basics">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title"><input className="input" value={p.title} onChange={(e) => set("title", e.target.value)} maxLength={140} /></Field>
          <Field label="URL slug (optional)"><input className="input" value={p.slug ?? ""} onChange={(e) => set("slug", e.target.value)} placeholder="auto from title" /></Field>
          <Field label="Description" wide><textarea className="input min-h-32" value={p.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Materials"><textarea className="input min-h-20" value={p.materials} onChange={(e) => set("materials", e.target.value)} /></Field>
          <Field label="Care instructions"><textarea className="input min-h-20" value={p.careInstructions} onChange={(e) => set("careInstructions", e.target.value)} /></Field>
          <Field label="Estimated production time"><input className="input" value={p.productionTime} onChange={(e) => set("productionTime", e.target.value)} placeholder="e.g. Made to order in 5–7 business days" /></Field>
          <Field label="Tags (comma separated)"><input className="input" value={p.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} /></Field>
          <Field label="Category">
            <select className="input" value={p.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Product type (for basic previews)">
            <select className="input" value={p.garmentType} onChange={(e) => set("garmentType", e.target.value as EditorProduct["garmentType"])}>
              {GARMENTS.map((g) => <option key={g} value={g}>{g.charAt(0) + g.slice(1).toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Base price ($)"><MoneyInput cents={p.basePriceCents} onChange={(c) => set("basePriceCents", c ?? 0)} /></Field>
          <Field label="Visibility">
            <select className="input" value={p.status} onChange={(e) => set("status", e.target.value as EditorProduct["status"])}>
              <option value="DRAFT">Draft (only you can see it)</option>
              <option value="PUBLISHED">Published</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <Check label="Featured on homepage" checked={p.isFeatured} onChange={(v) => set("isFeatured", v)} />
        </div>
      </Section>

      <Section title="Customization">
        <div className="flex flex-wrap gap-5 text-sm">
          <Check label="Customers can customize this product" checked={p.isCustomizable} onChange={(v) => set("isCustomizable", v)} />
          {p.isCustomizable && (
            <>
              <Check label="Allow “I have my own design” uploads" checked={p.allowUpload} onChange={(v) => set("allowUpload", v)} />
              <Check label="Allow “Help me create a design” requests" checked={p.allowDesignRequest} onChange={(v) => set("allowDesignRequest", v)} />
            </>
          )}
        </div>
        {p.isCustomizable && p.allowDesignRequest && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Design requests">
              <select className="input" value={p.designRequestMode} onChange={(e) => set("designRequestMode", e.target.value as "FIXED_FEE" | "QUOTE")}>
                <option value="FIXED_FEE">Charge a design fee at checkout</option>
                <option value="QUOTE">Quote first (no payment until priced)</option>
              </select>
            </Field>
            {p.designRequestMode === "FIXED_FEE" && (
              <Field label="Design fee for this product ($) — blank uses the global fee">
                <MoneyInput cents={p.designFeeCents} nullable onChange={(c) => set("designFeeCents", c)} />
              </Field>
            )}
          </div>
        )}
      </Section>

      <Section title="Colors">
        <p className="mb-3 text-xs text-charcoal/60">Only the colors listed here are offered to customers.</p>
        <div className="space-y-2">
          {p.colors.map((c, i) => (
            <div key={c.key} className="flex items-center gap-2">
              <input type="color" value={c.hex} onChange={(e) => set("colors", p.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))} className="h-10 w-12 rounded-lg border border-line" aria-label="Color swatch" />
              <input className="input max-w-xs" value={c.name} onChange={(e) => set("colors", p.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Color name" />
              <button className="text-xs text-red-700 underline" onClick={() => set("colors", p.colors.filter((_, j) => j !== i))} disabled={p.colors.length === 1}>Remove</button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm" onClick={() => set("colors", [...p.colors, { key: key(), name: "New color", hex: "#EBC2CA" }])}>+ Add color</button>
          {COLOR_PRESETS.filter((cp) => !p.colors.some((c) => c.name === cp.name)).map((cp) => (
            <button key={cp.name} className="chip" onClick={() => set("colors", [...p.colors, { key: key(), ...cp }])}>
              <span className="mr-1 h-3 w-3 rounded-full ring-1 ring-line" style={{ background: cp.hex }} />+ {cp.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sizes">
        <div className="space-y-2">
          {p.sizes.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <input className="input w-28" value={s.label} onChange={(e) => set("sizes", p.sizes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Size label" />
              <span className="text-xs">surcharge $</span>
              <div className="w-28"><MoneyInput cents={s.surchargeCents} onChange={(c) => set("sizes", p.sizes.map((x, j) => (j === i ? { ...x, surchargeCents: c ?? 0 } : x)))} /></div>
              <button className="text-xs text-red-700 underline" onClick={() => set("sizes", p.sizes.filter((_, j) => j !== i))} disabled={p.sizes.length === 1}>Remove</button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm" onClick={() => set("sizes", [...p.sizes, { key: key(), label: "", surchargeCents: 0 }])}>+ Add size</button>
          <button className="chip" onClick={() => set("sizes", ["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((label) => ({ key: key(), label, surchargeCents: label === "2XL" ? 200 : label === "3XL" ? 400 : 0 })))}>Use XS–3XL</button>
          <button className="chip" onClick={() => set("sizes", [{ key: key(), label: "One size", surchargeCents: 0 }])}>One size</button>
        </div>
        <div className="mt-4">
          <Field label="Size chart (first line = column headings, comma separated)">
            <textarea className="input min-h-28 font-mono text-xs" value={chartText} onChange={(e) => setChartText(e.target.value)} placeholder={"Size, Chest (in), Length (in)\nS, 36–38, 28\nM, 39–41, 29"} />
          </Field>
        </div>
      </Section>

      <Section title="Variants, stock & prices">
        <p className="mb-3 text-xs text-charcoal/60">Leave stock blank for made-to-order items. A variant price replaces base price + size surcharge.</p>
        <div className="overflow-x-auto">
          <table className="admin-table w-full min-w-[640px]">
            <thead><tr><th>Color</th><th>Size</th><th>Available</th><th>Stock</th><th>Variant price ($)</th><th>SKU</th></tr></thead>
            <tbody>
              {variants.map((v) => {
                const c = p.colors.find((x) => x.key === v.colorKey)!;
                const s = p.sizes.find((x) => x.key === v.sizeKey)!;
                return (
                  <tr key={`${v.colorKey}-${v.sizeKey}`}>
                    <td><span className="mr-1 inline-block h-3 w-3 rounded-full ring-1 ring-line" style={{ background: c.hex }} />{c.name}</td>
                    <td>{s.label}</td>
                    <td><input type="checkbox" checked={v.isAvailable} onChange={(e) => setVariant(v.colorKey, v.sizeKey, { isAvailable: e.target.checked })} aria-label="Available" /></td>
                    <td><input className="input w-24 py-1" inputMode="numeric" value={v.stock ?? ""} onChange={(e) => setVariant(v.colorKey, v.sizeKey, { stock: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0) })} aria-label="Stock" placeholder="∞" /></td>
                    <td className="w-32"><MoneyInput cents={v.priceOverrideCents} nullable onChange={(cc) => setVariant(v.colorKey, v.sizeKey, { priceOverrideCents: cc })} /></td>
                    <td><input className="input w-32 py-1" value={v.sku ?? ""} onChange={(e) => setVariant(v.colorKey, v.sizeKey, { sku: e.target.value || null })} aria-label="SKU" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {p.isCustomizable && (
        <Section title="Print locations">
          <p className="mb-3 text-xs text-charcoal/60">
            Area values are percentages of the (square) mockup image: X/Y = top-left corner, W/H = size. Width/height inches are the largest physical print and drive the low-resolution warning.
          </p>
          <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              {p.locations.map((l, i) => {
                const upd = (patch: Partial<Loc>) => set("locations", p.locations.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                const num = (k: keyof Loc, label: string, step = 1) => (
                  <label className="text-xs">
                    {label}
                    <input type="number" step={step} className="input mt-0.5 py-1" value={l[k] as number} onChange={(e) => upd({ [k]: parseFloat(e.target.value) || 0 } as Partial<Loc>)} />
                  </label>
                );
                return (
                  <div key={l.id ?? i} className="rounded-xl border border-line p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input className="input max-w-[12rem]" value={l.name} onChange={(e) => upd({ name: e.target.value })} aria-label="Location name" />
                      <select className="input w-28" value={l.view} onChange={(e) => { upd({ view: e.target.value as Loc["view"] }); setPreviewView(e.target.value); }} aria-label="View">
                        {VIEWS.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
                      </select>
                      <span className="text-xs">price $</span>
                      <div className="w-24"><MoneyInput cents={l.priceCents} onChange={(c) => upd({ priceCents: c ?? 0 })} /></div>
                      <button className="ml-auto text-xs text-red-700 underline" onClick={() => set("locations", p.locations.filter((_, j) => j !== i))}>Remove</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {num("areaX", "X %")}{num("areaY", "Y %")}{num("areaW", "W %")}{num("areaH", "H %")}{num("widthIn", "Max W in", 0.5)}{num("heightIn", "Max H in", 0.5)}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary btn-sm" onClick={() => set("locations", [...p.locations, { name: "New location", view: "FRONT", areaX: 35, areaY: 30, areaW: 30, areaH: 30, widthIn: 10, heightIn: 10, priceCents: 0 }])}>+ Add location</button>
                <button className="chip" onClick={() => set("locations", presetLocations)}>Use suggested locations for this product type</button>
              </div>
            </div>
            <div>
              <div className="mb-2 flex gap-1">
                {VIEWS.map((v) => <button key={v} onClick={() => setPreviewView(v)} className={cn("chip", previewView === v && "border-charcoal")}>{v.toLowerCase()}</button>)}
              </div>
              <div className="relative aspect-square overflow-hidden rounded-xl border border-line">
                <GarmentSilhouette type={p.garmentType} hex={previewHex} view={previewView} label={false} />
                {p.locations.filter((l) => l.view === previewView).map((l, i) => (
                  <div key={i} className="absolute border border-dashed border-gold bg-gold/10" style={{ left: `${l.areaX}%`, top: `${l.areaY}%`, width: `${l.areaW}%`, height: `${l.areaH}%` }}>
                    <span className="absolute -top-4 left-0 whitespace-nowrap text-[9px] text-gold">{l.name}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-charcoal/60">Guide shown on the basic silhouette. Check the real mockups on the store preview.</p>
            </div>
          </div>
        </Section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-6 py-3 backdrop-blur md:left-60">
        <div className="flex items-center gap-4">
          <button className="btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : p.id ? "Save changes" : "Create product"}</button>
          {msg && <p className={cn("text-sm", msg.ok ? "text-emerald-700" : "text-red-700")} role="status">{msg.text}</p>}
          {!p.id && <p className="text-xs text-charcoal/60">After creating, you can upload photos and mockups.</p>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("block", wide && "md:col-span-2")}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#E8B5C0]" /> {label}
    </label>
  );
}

function MoneyInput({ cents, onChange, nullable }: { cents: number | null; onChange: (c: number | null) => void; nullable?: boolean }) {
  const [text, setText] = useState(centsToDollars(cents));
  return (
    <input
      className="input py-1.5"
      inputMode="decimal"
      value={text}
      placeholder={nullable ? "—" : "0.00"}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (nullable && text.trim() === "") return onChange(null);
        const c = dollarsToCents(text);
        setText(centsToDollars(c));
        onChange(c);
      }}
      aria-label="Amount in dollars"
    />
  );
}
