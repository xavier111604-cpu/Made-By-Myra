"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProductPreview, type PreviewImage, type PreviewLocation, type PreviewPlacement } from "./product-preview";
import { FileDrop, type UploadedFile } from "../file-drop";
import { openCartDrawer } from "../site-header";
import { AlertIcon, CheckIcon, CloseIcon, FileIcon, PencilIcon, SparkleIcon, UploadIcon } from "../icons";
import { cn, formatMoney } from "@/lib/format";
import { DESIGN_STYLES } from "@/lib/labels";
import { dpiVerdict, effectiveDpi } from "@/lib/upload-rules";
import { addToCart } from "@/actions/cart";
import { submitQuoteRequest } from "@/actions/design-requests";
import type { Customization } from "@/lib/customization";

export type ConfigLocation = PreviewLocation & { priceCents: number; widthIn: number; heightIn: number };
export type ConfigProduct = {
  id: string;
  title: string;
  garmentType: string;
  basePriceCents: number;
  isCustomizable: boolean;
  allowUpload: boolean;
  allowDesignRequest: boolean;
  designRequestMode: "FIXED_FEE" | "QUOTE";
  designFeeCents: number;
  colors: { id: string; name: string; hex: string }[];
  sizes: { id: string; label: string; surchargeCents: number }[];
  variants: { colorId: string; sizeId: string; priceOverrideCents: number | null; stock: number | null; isAvailable: boolean }[];
  images: PreviewImage[];
  locations: ConfigLocation[];
  sizeChart: { columns: string[]; rows: string[][] } | null;
  materials: string | null;
  careInstructions: string | null;
  productionTime: string | null;
};

type PlacementState = {
  locationId: string;
  upload?: UploadedFile;
  x: number;
  y: number;
  scale: number;
  text: string;
  textFont: "script" | "sans";
  textColor: string;
};

type Method = "UPLOAD" | "DESIGN_REQUEST" | null;

const STEP_LABELS = ["Product", "Color", "Size", "Design", "Review"];

export function ProductConfigurator({ product, signedInEmail }: { product: ConfigProduct; signedInEmail: string | null }) {
  const router = useRouter();
  const [colorId, setColorId] = useState<string | null>(product.colors.length === 1 ? product.colors[0].id : null);
  const [sizeId, setSizeId] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0].id : null);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<Method>(null);
  const [placements, setPlacements] = useState<PlacementState[]>([]);
  const [activeLoc, setActiveLoc] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [rightsOk, setRightsOk] = useState(false);
  const [req, setReq] = useState({ description: "", textToInclude: "", preferredColors: "", style: "", placementLocationId: "", occasion: "", notes: "" });
  const [inspiration, setInspiration] = useState<UploadedFile[]>([]);
  const [quoteContact, setQuoteContact] = useState({ name: "", email: signedInEmail ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [pending, start] = useTransition();

  const views = useMemo(() => {
    const v = new Set<string>(["FRONT"]);
    product.locations.forEach((l) => v.add(l.view));
    product.images.filter((i) => i.kind === "MOCKUP").forEach((i) => v.add(i.view));
    return ["FRONT", "BACK", "LEFT", "RIGHT"].filter((x) => v.has(x));
  }, [product]);
  const [view, setView] = useState(views[0] ?? "FRONT");

  const color = product.colors.find((c) => c.id === colorId);
  const variantFor = (cId: string | null, sId: string | null) => product.variants.find((v) => v.colorId === cId && v.sizeId === sId);
  const variant = variantFor(colorId, sizeId);
  const sizeAvailable = (sId: string) => {
    if (!colorId) return product.variants.some((v) => v.sizeId === sId && v.isAvailable && (v.stock == null || v.stock > 0));
    const v = variantFor(colorId, sId);
    return Boolean(v && v.isAvailable && (v.stock == null || v.stock > 0));
  };

  // ── Price estimate (the server recalculates everything at add-to-bag and checkout) ──
  const size = product.sizes.find((s) => s.id === sizeId);
  const unit = variant?.priceOverrideCents ?? product.basePriceCents + (size?.surchargeCents ?? 0);
  const placementCost =
    method === "UPLOAD"
      ? placements.reduce((s, p) => s + (product.locations.find((l) => l.id === p.locationId)?.priceCents ?? 0), 0)
      : method === "DESIGN_REQUEST"
        ? (product.locations.find((l) => l.id === req.placementLocationId)?.priceCents ?? 0)
        : 0;
  const designFee = method === "DESIGN_REQUEST" && product.designRequestMode === "FIXED_FEE" ? product.designFeeCents : 0;
  const total = (unit + placementCost) * qty + designFee;
  const isQuote = method === "DESIGN_REQUEST" && product.designRequestMode === "QUOTE";

  const step = !colorId ? 1 : !sizeId ? 2 : product.isCustomizable && !method ? 3 : 4;

  // ── Placement helpers ──
  const togglePlacement = (locId: string) => {
    const loc = product.locations.find((l) => l.id === locId)!;
    if (placements.some((p) => p.locationId === locId)) {
      setPlacements((ps) => ps.filter((p) => p.locationId !== locId));
      if (activeLoc === locId) setActiveLoc(null);
    } else {
      setPlacements((ps) => [...ps, { locationId: locId, x: 0.5, y: 0.4, scale: 0.7, text: "", textFont: "script", textColor: "#302A29" }]);
      setActiveLoc(locId);
      setView(loc.view);
    }
  };
  const updatePlacement = (locId: string, patch: Partial<PlacementState>) =>
    setPlacements((ps) => ps.map((p) => (p.locationId === locId ? { ...p, ...patch } : p)));

  const previewPlacements: PreviewPlacement[] =
    method === "UPLOAD"
      ? placements.map((p) => ({
          locationId: p.locationId,
          previewUrl: p.upload?.previewUrl ?? null,
          isPdf: p.upload?.contentType === "application/pdf",
          x: p.x,
          y: p.y,
          scale: p.scale,
          text: p.text || undefined,
          textFont: p.textFont,
          textColor: p.textColor,
        }))
      : [];

  // ── Submit ──
  function buildCustomization(): Customization | string {
    if (!product.isCustomizable) return { method: "NONE" };
    if (method === "UPLOAD") {
      const used = placements.filter((p) => p.upload || p.text.trim());
      if (!used.length) return "Please upload your artwork (or add text) for at least one print location.";
      if (placements.some((p) => !p.upload && !p.text.trim())) return "One of your selected print locations is empty — add artwork or remove it.";
      if (used.some((p) => p.upload) && !rightsOk) return "Please confirm you have the right to use the artwork you uploaded.";
      return {
        method: "UPLOAD",
        instructions: instructions.trim() || undefined,
        placements: used.map((p) => ({
          locationId: p.locationId,
          uploadId: p.upload?.id,
          x: p.x,
          y: p.y,
          scale: p.scale,
          text: p.text.trim() || undefined,
          textFont: p.text.trim() ? p.textFont : undefined,
          textColor: p.text.trim() ? p.textColor : undefined,
        })),
      };
    }
    if (method === "DESIGN_REQUEST") {
      if (req.description.trim().length < 10) return "Please describe your idea in a little more detail.";
      const o = (s: string) => s.trim() || undefined;
      return {
        method: "DESIGN_REQUEST",
        request: {
          description: req.description.trim(),
          textToInclude: o(req.textToInclude),
          preferredColors: o(req.preferredColors),
          style: o(req.style),
          placementLocationId: o(req.placementLocationId),
          occasion: o(req.occasion),
          notes: o(req.notes),
          inspirationUploadIds: inspiration.map((i) => i.id),
        },
      };
    }
    return "Please choose how you'd like to customize this item.";
  }

  function submit() {
    setError(null);
    setSuccess(null);
    if (!colorId) return setError("Please choose a color.");
    if (!sizeId) return setError("Please choose a size.");
    const c = buildCustomization();
    if (typeof c === "string") return setError(c);
    start(async () => {
      if (isQuote && c.method === "DESIGN_REQUEST") {
        const res = await submitQuoteRequest({ productId: product.id, colorId, sizeId, quantity: qty, name: quoteContact.name, email: quoteContact.email, request: c.request });
        if (res.ok) setSuccess("Thank you! Your design request was sent. We'll reply by email with a quote — nothing has been charged.");
        else setError(res.error);
        return;
      }
      const res = await addToCart({ productId: product.id, colorId, sizeId, quantity: qty, customization: c });
      if (res.ok) {
        router.refresh();
        openCartDrawer();
      } else setError(res.error);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      {/* Preview */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <ProductPreview
          images={product.images}
          colorId={colorId}
          colorHex={color?.hex ?? product.colors[0]?.hex ?? "#FFFFFF"}
          garmentType={product.garmentType}
          view={view}
          views={views}
          onViewChange={setView}
          locations={product.locations}
          placements={previewPlacements}
          activeLocationId={method === "UPLOAD" ? activeLoc : null}
          onMove={(id, x, y) => updatePlacement(id, { x, y })}
          pendingDesign={method === "DESIGN_REQUEST"}
        />
        {method === "UPLOAD" && activeLoc && placements.find((p) => p.locationId === activeLoc) && (
          <div className="mt-4 rounded-2xl bg-cream p-4">
            <label htmlFor="scale" className="label">Artwork size — {product.locations.find((l) => l.id === activeLoc)?.name}</label>
            <input
              id="scale"
              type="range"
              min={10}
              max={100}
              value={Math.round((placements.find((p) => p.locationId === activeLoc)?.scale ?? 0.7) * 100)}
              onChange={(e) => updatePlacement(activeLoc, { scale: Number(e.target.value) / 100 })}
              className="w-full accent-[#BB9255]"
            />
            <p className="mt-1 text-xs text-charcoal/60">Drag the artwork on the preview (or focus it and use arrow keys) to position it.</p>
          </div>
        )}
      </div>

      {/* Options */}
      <div>
        {product.isCustomizable && (
          <ol className="mb-6 flex items-center gap-1" aria-label="Customization progress">
            {STEP_LABELS.map((label, i) => (
              <li key={label} className="flex flex-1 flex-col items-center gap-1">
                <span className={cn("h-1.5 w-full rounded-full transition-colors duration-500", i <= step ? "bg-blush-dusty" : "bg-line")} />
                <span className={cn("text-[11px]", i <= step ? "font-semibold text-charcoal" : "text-charcoal/50")}>{label}</span>
              </li>
            ))}
          </ol>
        )}

        {/* Color */}
        <section aria-labelledby="color-h" className="mb-7">
          <h2 id="color-h" className="mb-3 text-sm font-semibold">
            Color{color ? <span className="font-normal text-charcoal/70"> — {color.name}</span> : null}
          </h2>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-labelledby="color-h">
            {product.colors.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={colorId === c.id}
                aria-label={c.name}
                title={c.name}
                onClick={() => setColorId(c.id)}
                className={cn(
                  "h-10 w-10 rounded-full border border-line transition hover:scale-110",
                  colorId === c.id && "ring-2 ring-gold ring-offset-2",
                )}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </section>

        {/* Size */}
        <section aria-labelledby="size-h" className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="size-h" className="text-sm font-semibold">Size</h2>
            {product.sizeChart && (
              <button className="text-xs font-medium text-gold underline-offset-2 hover:underline" onClick={() => setShowChart(true)}>
                Size chart
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="size-h">
            {product.sizes.map((s) => {
              const avail = sizeAvailable(s.id);
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={sizeId === s.id}
                  disabled={!avail}
                  onClick={() => setSizeId(s.id)}
                  className={cn(
                    "min-w-[3.25rem] rounded-xl border px-3 py-2 text-sm font-medium transition",
                    sizeId === s.id ? "border-charcoal bg-charcoal text-white" : "border-line bg-white hover:border-blush-dusty",
                    !avail && "cursor-not-allowed line-through opacity-40",
                  )}
                >
                  {s.label}
                  {s.surchargeCents > 0 && <span className="block text-[10px] font-normal opacity-70">+{formatMoney(s.surchargeCents)}</span>}
                </button>
              );
            })}
          </div>
          {variant?.stock != null && variant.stock > 0 && variant.stock <= 5 && <p className="mt-2 text-xs text-gold">Only {variant.stock} left</p>}
        </section>

        {/* Method */}
        {product.isCustomizable && (
          <section aria-labelledby="method-h" className="mb-7">
            <h2 id="method-h" className="mb-3 text-sm font-semibold">How would you like to customize it?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {product.allowUpload && (
                <MethodCard
                  active={method === "UPLOAD"}
                  onClick={() => setMethod("UPLOAD")}
                  Icon={UploadIcon}
                  title="I Have My Own Design"
                  text="Upload your artwork, choose where it goes, and preview it."
                />
              )}
              {product.allowDesignRequest && (
                <MethodCard
                  active={method === "DESIGN_REQUEST"}
                  onClick={() => setMethod("DESIGN_REQUEST")}
                  Icon={PencilIcon}
                  title="Help Me Create a Design"
                  text="Have an idea but need help bringing it to life? Describe your vision and we'll work with you to create something special."
                />
              )}
            </div>
          </section>
        )}

        {/* Upload flow */}
        {method === "UPLOAD" && (
          <section className="mb-7 animate-fade-in space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Choose print location(s)</h3>
              <div className="flex flex-wrap gap-2">
                {product.locations.map((l) => {
                  const on = placements.some((p) => p.locationId === l.id);
                  return (
                    <button
                      key={l.id}
                      aria-pressed={on}
                      onClick={() => (on && activeLoc !== l.id ? (setActiveLoc(l.id), setView(l.view)) : togglePlacement(l.id))}
                      className={cn("chip gap-1.5 py-1.5 text-sm transition", on ? "border-charcoal bg-white" : "hover:border-blush-dusty", activeLoc === l.id && "ring-2 ring-blush-dusty")}
                    >
                      {on && <CheckIcon size={14} />} {l.name}
                      {l.priceCents > 0 && <span className="text-charcoal/60">+{formatMoney(l.priceCents)}</span>}
                    </button>
                  );
                })}
              </div>
              {product.locations.length === 0 && <p className="text-sm text-charcoal/60">Print locations haven&apos;t been set up for this product yet.</p>}
            </div>

            {placements.map((p) => {
              const loc = product.locations.find((l) => l.id === p.locationId)!;
              const dpi = p.upload?.width && p.upload.height ? effectiveDpi(p.upload.width, p.upload.height, loc.widthIn, loc.heightIn, p.scale) : null;
              const verdict = dpi ? dpiVerdict(dpi) : null;
              return (
                <div
                  key={p.locationId}
                  className={cn("rounded-2xl border p-4 transition", activeLoc === p.locationId ? "border-blush-dusty bg-white shadow-soft" : "border-line")}
                  onFocusCapture={() => {
                    setActiveLoc(p.locationId);
                    setView(loc.view);
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-medium">{loc.name}</p>
                    <button className="text-xs text-charcoal/60 hover:underline" onClick={() => togglePlacement(p.locationId)}>
                      Remove location
                    </button>
                  </div>
                  {p.upload ? (
                    <div className="flex items-center gap-3 rounded-xl bg-cream p-3">
                      {p.upload.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.upload.previewUrl} alt="" className="h-14 w-14 rounded-lg bg-white object-contain" />
                      ) : (
                        <span className="grid h-14 w-14 place-items-center rounded-lg bg-white"><FileIcon /></span>
                      )}
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium">{p.upload.filename}</p>
                        {p.upload.width && <p className="text-xs text-charcoal/60">{p.upload.width} × {p.upload.height} px</p>}
                        {p.upload.contentType === "application/pdf" && <p className="text-xs text-charcoal/60">PDF received — we&apos;ll review it before printing.</p>}
                      </div>
                      <button className="btn-ghost" aria-label="Remove file" onClick={() => updatePlacement(p.locationId, { upload: undefined })}>
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  ) : (
                    <FileDrop purpose="ARTWORK" compact label="Upload artwork" onUploaded={(f) => updatePlacement(p.locationId, { upload: f })} />
                  )}
                  {verdict === "low" && (
                    <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900" role="alert">
                      <AlertIcon size={16} className="shrink-0" /> This image may print blurry at this size (about {dpi} DPI). Try a larger file or make the artwork smaller.
                    </p>
                  )}
                  {verdict === "ok" && <p className="mt-2 text-xs text-charcoal/60">Resolution is acceptable (about {dpi} DPI). Higher-resolution files print sharper.</p>}
                  {verdict === "good" && <p className="mt-2 text-xs text-emerald-700">Great resolution for this print size ♡</p>}

                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <label className="sr-only" htmlFor={`txt-${p.locationId}`}>Optional text</label>
                    <input
                      id={`txt-${p.locationId}`}
                      className="input"
                      maxLength={60}
                      placeholder="Optional text (e.g. a name)"
                      value={p.text}
                      onChange={(e) => updatePlacement(p.locationId, { text: e.target.value })}
                    />
                    <select aria-label="Text style" className="input" value={p.textFont} onChange={(e) => updatePlacement(p.locationId, { textFont: e.target.value as "script" | "sans" })}>
                      <option value="script">Handwritten</option>
                      <option value="sans">Clean</option>
                    </select>
                    <input aria-label="Text color" type="color" className="h-10 w-12 cursor-pointer rounded-xl border border-line" value={p.textColor} onChange={(e) => updatePlacement(p.locationId, { textColor: e.target.value })} />
                  </div>
                </div>
              );
            })}

            <div>
              <label htmlFor="instructions" className="label">Special instructions (optional)</label>
              <textarea id="instructions" className="input min-h-24" maxLength={1500} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Anything we should know about size, placement or colors?" />
            </div>
            {placements.some((p) => p.upload) && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={rightsOk} onChange={(e) => setRightsOk(e.target.checked)} className="mt-1 accent-[#E8B5C0]" />
                <span>I confirm I own or have permission to use the artwork I uploaded.</span>
              </label>
            )}
          </section>
        )}

        {/* Design request flow */}
        {method === "DESIGN_REQUEST" && (
          <section className="mb-7 animate-fade-in space-y-4">
            <div className="rounded-2xl bg-cream p-4 text-sm">
              <p className="heading-script text-2xl">Tell us what you&apos;re dreaming of ♡</p>
              <p className="mt-1 text-charcoal/70">
                This is a custom design request: we&apos;ll create your design by hand and send you a proof to approve before anything is made.
                {product.designRequestMode === "FIXED_FEE" && ` A design service fee of ${formatMoney(product.designFeeCents)} applies.`}
                {product.designRequestMode === "QUOTE" && " We'll reply with a quote — nothing is charged now."}
              </p>
            </div>
            <div>
              <label htmlFor="dr-desc" className="label">Your idea *</label>
              <textarea
                id="dr-desc"
                className="input min-h-36"
                maxLength={3000}
                value={req.description}
                onChange={(e) => setReq({ ...req, description: e.target.value })}
                placeholder="I want a pink hoodie with a small floral design on the front and my name written in cursive."
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="dr-text" label="Text or names to include" value={req.textToInclude} onChange={(v) => setReq({ ...req, textToInclude: v })} max={300} />
              <Field id="dr-colors" label="Preferred colors" value={req.preferredColors} onChange={(v) => setReq({ ...req, preferredColors: v })} max={200} />
              <div>
                <label htmlFor="dr-style" className="label">Design style</label>
                <select id="dr-style" className="input" value={req.style} onChange={(e) => setReq({ ...req, style: e.target.value })}>
                  <option value="">No preference</option>
                  {DESIGN_STYLES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dr-place" className="label">Desired placement</label>
                <select id="dr-place" className="input" value={req.placementLocationId} onChange={(e) => setReq({ ...req, placementLocationId: e.target.value })}>
                  <option value="">Let Myra suggest</option>
                  {product.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.priceCents ? ` (+${formatMoney(l.priceCents)})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Field id="dr-occasion" label="Occasion" value={req.occasion} onChange={(v) => setReq({ ...req, occasion: v })} max={120} />
            </div>
            <div>
              <p className="label">Inspiration images (optional, up to 5)</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {inspiration.map((f) => (
                  <div key={f.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {f.previewUrl ? <img src={f.previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-lg bg-cream"><FileIcon /></span>}
                    <button
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow"
                      aria-label={`Remove ${f.filename}`}
                      onClick={() => setInspiration((xs) => xs.filter((x) => x.id !== f.id))}
                    >
                      <CloseIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {inspiration.length < 5 && <FileDrop purpose="INSPIRATION" compact multiple label="Add inspiration" onUploaded={(f) => setInspiration((xs) => [...xs, f].slice(0, 5))} />}
            </div>
            <div>
              <label htmlFor="dr-notes" className="label">Additional notes</label>
              <textarea id="dr-notes" className="input min-h-20" maxLength={1500} value={req.notes} onChange={(e) => setReq({ ...req, notes: e.target.value })} />
            </div>
            {isQuote && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="q-name" label="Your name" value={quoteContact.name} onChange={(v) => setQuoteContact({ ...quoteContact, name: v })} max={100} />
                <Field id="q-email" label="Email for your quote *" type="email" value={quoteContact.email} onChange={(v) => setQuoteContact({ ...quoteContact, email: v })} max={200} />
              </div>
            )}
          </section>
        )}

        {/* Quantity + total */}
        <div className="mb-4 flex items-center gap-4">
          <label htmlFor="qty" className="text-sm font-semibold">Quantity</label>
          <div className="flex items-center rounded-full border border-line">
            <button className="px-3 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
            <input id="qty" inputMode="numeric" className="w-10 bg-transparent text-center" value={qty} onChange={(e) => setQty(Math.min(50, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))} />
            <button className="px-3 py-2" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="Increase quantity">+</button>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-white/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mb-3 space-y-0.5 text-sm">
            <Row label={`Item × ${qty}`} value={formatMoney(unit * qty)} />
            {placementCost > 0 && <Row label="Customization" value={formatMoney(placementCost * qty)} />}
            {designFee > 0 && <Row label="Design service" value={formatMoney(designFee)} />}
            {!isQuote && <Row label="Estimated total" value={formatMoney(total)} bold />}
            <p className="text-xs text-charcoal/60">{isQuote ? "We'll send you a quote before anything is charged." : "Shipping and taxes are calculated at checkout."}</p>
          </div>
          {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
          {success && <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{success}</p>}
          <button className="btn-primary w-full py-3.5 text-base" onClick={submit} disabled={pending}>
            {pending ? "Just a moment…" : isQuote ? "Send my design request" : (
              <>
                <SparkleIcon size={18} /> Add to bag
              </>
            )}
          </button>
        </div>

        {/* Details */}
        <div className="mt-8 divide-y divide-line border-y border-line text-sm">
          {product.materials && <Detail title="Materials">{product.materials}</Detail>}
          {product.productionTime && <Detail title="Production time">{product.productionTime}</Detail>}
          {product.careInstructions && <Detail title="Care instructions">{product.careInstructions}</Detail>}
        </div>
      </div>

      {showChart && product.sizeChart && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Size chart">
          <div className="absolute inset-0 bg-charcoal/30" onClick={() => setShowChart(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-lift">
            <button className="btn-ghost absolute right-3 top-3" onClick={() => setShowChart(false)} aria-label="Close size chart" autoFocus>
              <CloseIcon />
            </button>
            <h3 className="heading-script mb-4 text-3xl">Size chart</h3>
            <div className="overflow-x-auto">
              <table className="admin-table w-full">
                <thead>
                  <tr>{product.sizeChart.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {product.sizeChart.rows.map((r, i) => (
                    <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MethodCard({ active, onClick, Icon, title, text }: { active: boolean; onClick: () => void; Icon: typeof UploadIcon; title: string; text: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
        active ? "border-blush-dusty bg-blush/40 shadow-soft" : "border-line bg-white",
      )}
    >
      <Icon className="mb-2 text-gold" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-charcoal/70">{text}</p>
    </button>
  );
}

function Field({ id, label, value, onChange, max, type = "text" }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; type?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} type={type} className="input" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "pt-1 text-base font-semibold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
        {title} <span className="transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-2 whitespace-pre-line text-charcoal/75">{children}</p>
    </details>
  );
}
