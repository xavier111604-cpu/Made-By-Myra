// Basic, clearly-labelled garment silhouettes used when the owner hasn't uploaded a mockup
// for a product/color. These are approximations only — never presented as product photos.
import { cn } from "@/lib/format";

const PATHS: Record<string, { front: string; back?: string }> = {
  TSHIRT: {
    front: "M70 20 L40 32 L14 70 L40 84 L52 68 L52 186 L148 186 L148 68 L160 84 L186 70 L160 32 L130 20 C124 34 112 40 100 40 C88 40 76 34 70 20 Z",
    back: "M70 20 L40 32 L14 70 L40 84 L52 68 L52 186 L148 186 L148 68 L160 84 L186 70 L160 32 L130 20 C122 26 112 28 100 28 C88 28 78 26 70 20 Z",
  },
  LONGSLEEVE: {
    front: "M70 20 L40 32 L18 120 L8 168 L30 172 L46 120 L52 92 L52 186 L148 186 L148 92 L154 120 L170 172 L192 168 L182 120 L160 32 L130 20 C124 34 112 40 100 40 C88 40 76 34 70 20 Z",
  },
  HOODIE: {
    front: "M66 26 C66 6 134 6 134 26 L162 38 L184 120 L192 170 L170 174 L154 120 L150 96 L150 188 L50 188 L50 96 L46 120 L30 174 L8 170 L16 120 L38 38 Z M76 30 C84 50 116 50 124 30 C118 14 82 14 76 30 Z",
  },
  CREWNECK: {
    front: "M72 22 L40 34 L16 120 L8 170 L30 174 L46 120 L52 94 L52 186 L148 186 L148 94 L154 120 L170 174 L192 170 L184 120 L160 34 L128 22 C122 32 112 36 100 36 C88 36 78 32 72 22 Z",
  },
  SWEATPANTS: {
    front: "M56 14 L144 14 L150 40 L160 186 L118 190 L104 70 L96 70 L82 190 L40 186 L50 40 Z",
  },
  SHORTS: { front: "M50 40 L150 40 L162 140 L114 146 L102 90 L98 90 L86 146 L38 140 Z" },
  TOTE: { front: "M40 70 L160 70 L166 190 L34 190 Z M72 70 C72 20 128 20 128 70 L118 70 C118 34 82 34 82 70 Z" },
  OTHER: { front: "M40 40 H160 V170 H40 Z" },
};

function isLight(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}

export function GarmentSilhouette({
  type,
  hex = "#FFFFFF",
  view = "FRONT",
  className,
  label = true,
}: {
  type: string;
  hex?: string;
  view?: "FRONT" | "BACK" | string;
  className?: string;
  label?: boolean;
}) {
  const shape = PATHS[type] ?? PATHS.OTHER;
  const d = view === "BACK" && shape.back ? shape.back : shape.front;
  return (
    <div className={cn("relative h-full w-full", className)}>
      <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label={`Basic ${view.toLowerCase()} preview`}>
        <rect width="200" height="200" fill="#FFF9F8" />
        <path d={d} fill={hex} stroke={isLight(hex) ? "#d9cbc8" : "rgba(0,0,0,0.15)"} strokeWidth="1.5" fillRule="evenodd" />
      </svg>
      {label && (
        <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-charcoal/70">
          Basic preview · color approximate
        </span>
      )}
    </div>
  );
}
