// Shared upload rules (client + server). The server re-validates everything.

export type UploadPurposeKey =
  | "ARTWORK"
  | "INSPIRATION"
  | "PROOF"
  | "REVIEW_PHOTO"
  | "CONTACT"
  | "MESSAGE"
  | "PRODUCT_IMAGE"
  | "CONTENT_IMAGE";

const MB = 1024 * 1024;

export const IMAGE_TYPES = ["image/png", "image/jpeg"];
export const ARTWORK_TYPES = ["image/png", "image/jpeg", "application/pdf", "image/svg+xml"];

export const UPLOAD_RULES: Record<UploadPurposeKey, { types: string[]; maxBytes: number; isPublic: boolean; adminOnly?: boolean }> = {
  ARTWORK: { types: ARTWORK_TYPES, maxBytes: 25 * MB, isPublic: false },
  INSPIRATION: { types: [...IMAGE_TYPES, "image/webp"], maxBytes: 10 * MB, isPublic: false },
  PROOF: { types: [...IMAGE_TYPES, "application/pdf"], maxBytes: 25 * MB, isPublic: false, adminOnly: true },
  REVIEW_PHOTO: { types: [...IMAGE_TYPES, "image/webp"], maxBytes: 8 * MB, isPublic: false },
  CONTACT: { types: [...IMAGE_TYPES, "application/pdf"], maxBytes: 10 * MB, isPublic: false },
  MESSAGE: { types: [...IMAGE_TYPES, "application/pdf"], maxBytes: 15 * MB, isPublic: false },
  PRODUCT_IMAGE: { types: [...IMAGE_TYPES, "image/webp"], maxBytes: 10 * MB, isPublic: true, adminOnly: true },
  CONTENT_IMAGE: { types: [...IMAGE_TYPES, "image/webp"], maxBytes: 10 * MB, isPublic: true, adminOnly: true },
};

export const SVG_MAX_BYTES = 2 * MB;

export function extensionFor(type: string) {
  return (
    { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf", "image/svg+xml": "svg" } as Record<
      string,
      string
    >
  )[type];
}

export function acceptAttr(purpose: UploadPurposeKey) {
  return UPLOAD_RULES[purpose].types.join(",");
}

export function humanTypes(purpose: UploadPurposeKey) {
  return UPLOAD_RULES[purpose].types.map((t) => extensionFor(t)?.toUpperCase()).join(", ");
}

/** Effective print resolution of an image placed at `scale` (fraction of the print area width). */
export function effectiveDpi(pxW: number, pxH: number, areaWidthIn: number, areaHeightIn: number, scale: number) {
  const printedW = areaWidthIn * scale;
  const printedH = printedW * (pxH / pxW);
  const limitedH = Math.min(printedH, areaHeightIn);
  return Math.round(Math.min(pxW / printedW, pxH / limitedH));
}

export function dpiVerdict(dpi: number): "good" | "ok" | "low" {
  if (dpi >= 250) return "good";
  if (dpi >= 150) return "ok";
  return "low";
}
