"use client";

import { useEffect, useRef, useState } from "react";
import { GarmentSilhouette } from "../garment-preview";
import { FileIcon, HeartIcon } from "../icons";
import { cn } from "@/lib/format";

export type PreviewImage = { url: string; colorId: string | null; view: string; kind: "PHOTO" | "MOCKUP"; alt: string | null };
export type PreviewLocation = { id: string; name: string; view: string; areaX: number; areaY: number; areaW: number; areaH: number };
export type PreviewPlacement = {
  locationId: string;
  previewUrl: string | null;
  isPdf?: boolean;
  x: number;
  y: number;
  scale: number;
  text?: string;
  textFont?: "script" | "sans";
  textColor?: string;
};

export function ProductPreview({
  images,
  colorId,
  colorHex,
  garmentType,
  view,
  views,
  onViewChange,
  locations,
  placements,
  activeLocationId,
  onMove,
  pendingDesign,
}: {
  images: PreviewImage[];
  colorId: string | null;
  colorHex: string;
  garmentType: string;
  view: string;
  views: string[];
  onViewChange: (v: string) => void;
  locations: PreviewLocation[];
  placements: PreviewPlacement[];
  activeLocationId: string | null;
  onMove: (locationId: string, x: number, y: number) => void;
  pendingDesign: boolean;
}) {
  const showPrintAreas = placements.length > 0 || activeLocationId;
  // Owner-uploaded mockup for this exact color + view. We never recolor images with filters.
  const mockup =
    images.find((i) => i.kind === "MOCKUP" && i.colorId === colorId && i.view === view) ??
    (!showPrintAreas ? images.find((i) => i.kind === "PHOTO" && i.colorId === colorId && i.view === view) : undefined);
  const viewLocations = locations.filter((l) => l.view === view);

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-cream">
        {mockup ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mockup.url} alt={mockup.alt ?? "Product mockup"} className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <GarmentSilhouette type={garmentType} hex={colorHex} view={view} className="absolute inset-0" />
        )}

        {viewLocations.map((loc) => {
          const p = placements.find((pl) => pl.locationId === loc.id);
          const active = activeLocationId === loc.id;
          if (!p && !active) return null;
          return <PrintArea key={loc.id} loc={loc} placement={p} active={active} onMove={onMove} />;
        })}

        {pendingDesign && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl bg-white/90 p-4 text-center shadow-soft">
            <HeartIcon className="mx-auto mb-1 text-blush-hover" />
            <p className="heading-script text-2xl">Your design is pending creation</p>
            <p className="text-xs text-charcoal/70">We&apos;ll create it from your description and send you a proof to approve.</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {views.length > 1 ? (
          <div className="flex gap-2" role="tablist" aria-label="Preview view">
            {views.map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => onViewChange(v)}
                className={cn("chip transition", view === v ? "border-charcoal bg-white" : "hover:border-blush-dusty")}
              >
                {v.charAt(0) + v.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {placements.length > 0 && <p className="text-right text-[11px] text-charcoal/60">Preview is an approximation, not a print proof.</p>}
      </div>
    </div>
  );
}

function PrintArea({
  loc,
  placement,
  active,
  onMove,
}: {
  loc: PreviewLocation;
  placement?: PreviewPlacement;
  active: boolean;
  onMove: (locationId: string, x: number, y: number) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaW, setAreaW] = useState(100);
  const dragging = useRef(false);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAreaW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const moveTo = (clientX: number, clientY: number) => {
    const r = areaRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    onMove(loc.id, x, y);
  };

  return (
    <div
      ref={areaRef}
      className={cn("absolute", active ? "outline-dashed outline-1 outline-gold/70" : "")}
      style={{ left: `${loc.areaX}%`, top: `${loc.areaY}%`, width: `${loc.areaW}%`, height: `${loc.areaH}%` }}
      aria-label={`${loc.name} print area`}
    >
      {active && !placement && <span className="absolute -top-5 left-0 whitespace-nowrap text-[10px] font-medium text-gold">{loc.name}</span>}
      {placement && (placement.previewUrl || placement.isPdf || placement.text) && (
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Position artwork on ${loc.name}. Use arrow keys to move.`}
          aria-valuetext={`${Math.round(placement.x * 100)}% across, ${Math.round(placement.y * 100)}% down`}
          className={cn("absolute flex cursor-grab touch-none select-none flex-col items-center active:cursor-grabbing", active && "ring-1 ring-gold/60")}
          style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, width: `${placement.scale * 100}%`, transform: "translate(-50%, -50%)" }}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => dragging.current && moveTo(e.clientX, e.clientY)}
          onPointerUp={() => (dragging.current = false)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.1 : 0.02;
            const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            const delta = d[e.key];
            if (!delta) return;
            e.preventDefault();
            onMove(loc.id, Math.min(1, Math.max(0, placement.x + delta[0])), Math.min(1, Math.max(0, placement.y + delta[1])));
          }}
        >
          {placement.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={placement.previewUrl} alt="Your artwork" draggable={false} className="pointer-events-none w-full" />
          ) : placement.isPdf ? (
            <div className="pointer-events-none flex w-full flex-col items-center rounded-lg bg-white/80 p-2 text-[10px]">
              <FileIcon /> PDF artwork
            </div>
          ) : null}
          {placement.text && (
            <span
              className={cn("pointer-events-none whitespace-nowrap leading-tight", placement.textFont === "sans" ? "font-sans font-semibold" : "font-script")}
              style={{ color: placement.textColor ?? "#302A29", fontSize: `${Math.max(8, areaW * placement.scale * 0.2)}px` }}
            >
              {placement.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
