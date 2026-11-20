"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDrop } from "../file-drop";
import { addProductImage, deleteProductImage, updateProductImage } from "@/actions/admin-products";

type Img = { id: string; url: string; colorId: string | null; view: string; kind: string; alt: string; sortOrder: number };
const VIEWS = ["FRONT", "BACK", "LEFT", "RIGHT", "DETAIL", "LIFESTYLE"];

export function ImageManager({ productId, colors, images }: { productId: string; colors: { id: string; name: string }[]; images: Img[] }) {
  const router = useRouter();
  const [defaults, setDefaults] = useState({ colorId: colors[0]?.id ?? "", view: "FRONT", kind: "PHOTO" as "PHOTO" | "MOCKUP" });
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold">Photos & mockups</h2>
      <p className="mt-1 text-xs text-charcoal/60">
        <strong>Photos</strong> appear in the shop and on the product page. <strong>Mockups</strong> are blank garment images used by the customizer preview — upload one per color and view
        (square images work best). Colors without a mockup show a labelled basic preview instead.
      </p>

      <div className="mt-4 grid gap-3 rounded-xl bg-cream p-4 sm:grid-cols-4">
        <label className="text-sm">Type
          <select className="input mt-1" value={defaults.kind} onChange={(e) => setDefaults({ ...defaults, kind: e.target.value as "PHOTO" | "MOCKUP" })}>
            <option value="PHOTO">Product photo</option>
            <option value="MOCKUP">Customizer mockup</option>
          </select>
        </label>
        <label className="text-sm">Color
          <select className="input mt-1" value={defaults.colorId} onChange={(e) => setDefaults({ ...defaults, colorId: e.target.value })}>
            <option value="">Any / not color-specific</option>
            {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">View
          <select className="input mt-1" value={defaults.view} onChange={(e) => setDefaults({ ...defaults, view: e.target.value })}>
            {VIEWS.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
          </select>
        </label>
        <div className="self-end">
          <FileDrop
            purpose="PRODUCT_IMAGE"
            compact
            multiple
            label="Upload images"
            onUploaded={(f) =>
              start(async () => {
                const res = await addProductImage({ productId, uploadId: f.id, colorId: defaults.colorId || null, view: defaults.view as "FRONT", kind: defaults.kind });
                if (!res.ok) setError(res.error);
                router.refresh();
              })
            }
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {images.map((img) => (
          <ImageCard key={img.id} img={img} colors={colors} onChanged={() => router.refresh()} />
        ))}
        {images.length === 0 && <p className="col-span-full text-sm text-charcoal/60">No images yet.</p>}
      </div>
    </section>
  );
}

function ImageCard({ img, colors, onChanged }: { img: Img; colors: { id: string; name: string }[]; onChanged: () => void }) {
  const [state, setState] = useState(img);
  const [pending, start] = useTransition();
  const save = (patch: Partial<Img>) => {
    const next = { ...state, ...patch };
    setState(next);
    start(async () => {
      await updateProductImage({ id: img.id, colorId: next.colorId, view: next.view, kind: next.kind, alt: next.alt, sortOrder: next.sortOrder });
      onChanged();
    });
  };
  return (
    <div className={`rounded-xl border border-line p-2 text-xs ${pending ? "opacity-60" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={img.alt} className="aspect-square w-full rounded-lg bg-cream object-cover" />
      <select className="input mt-2 py-1 text-xs" value={state.kind} onChange={(e) => save({ kind: e.target.value })} aria-label="Image type">
        <option value="PHOTO">Photo</option>
        <option value="MOCKUP">Mockup</option>
      </select>
      <select className="input mt-1 py-1 text-xs" value={state.colorId ?? ""} onChange={(e) => save({ colorId: e.target.value || null })} aria-label="Color">
        <option value="">Any color</option>
        {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select className="input mt-1 py-1 text-xs" value={state.view} onChange={(e) => save({ view: e.target.value })} aria-label="View">
        {VIEWS.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
      </select>
      <input className="input mt-1 py-1 text-xs" defaultValue={state.alt} placeholder="Alt text" onBlur={(e) => e.target.value !== state.alt && save({ alt: e.target.value })} aria-label="Alt text" />
      <input className="input mt-1 py-1 text-xs" type="number" min={0} defaultValue={state.sortOrder} onBlur={(e) => save({ sortOrder: parseInt(e.target.value, 10) || 0 })} aria-label="Sort order" title="Order (lower first)" />
      <button className="mt-2 text-red-700 underline" onClick={() => start(async () => { await deleteProductImage(img.id); onChanged(); })}>Delete</button>
    </div>
  );
}
