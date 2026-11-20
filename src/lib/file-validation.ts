import { SVG_MAX_BYTES } from "./upload-rules";

/** Check the real file signature so a renamed file can't slip through. */
export function matchesSignature(type: string, head: Buffer): boolean {
  const hex = head.subarray(0, 12).toString("hex");
  switch (type) {
    case "image/png":
      return hex.startsWith("89504e470d0a1a0a");
    case "image/jpeg":
      return hex.startsWith("ffd8ff");
    case "application/pdf":
      return head.subarray(0, 5).toString("latin1") === "%PDF-";
    case "image/webp":
      return head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP";
    case "image/svg+xml": {
      const text = head.toString("utf8").trimStart().toLowerCase();
      return text.startsWith("<?xml") || text.startsWith("<svg") || text.startsWith("<!--");
    }
    default:
      return false;
  }
}

/**
 * Conservative SVG safety check. We never inline customer SVGs into our pages (they are only
 * shown through <img>, which does not run scripts), but we still reject anything active.
 */
export function svgIsSafe(full: Buffer): { ok: boolean; reason?: string } {
  if (full.length > SVG_MAX_BYTES) return { ok: false, reason: "SVG files must be under 2 MB." };
  const s = full.toString("utf8").toLowerCase();
  const banned = [
    /<script/,
    /<foreignobject/,
    /\son[a-z]+\s*=/,
    /javascript:/,
    /<!entity/,
    /<iframe/,
    /<embed/,
    /<object/,
    /xlink:href\s*=\s*["'](?!#)/,
    /\shref\s*=\s*["'](?!#|data:image\/(png|jpe?g);)/,
  ];
  for (const re of banned) if (re.test(s)) return { ok: false, reason: "This SVG contains scripts or external links we can't accept. Please export it as PNG or PDF." };
  if (!s.includes("<svg")) return { ok: false, reason: "That file doesn't look like a valid SVG." };
  return { ok: true };
}
