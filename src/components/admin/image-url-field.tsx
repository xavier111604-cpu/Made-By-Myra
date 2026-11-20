"use client";

import { useState } from "react";
import { FileDrop } from "../file-drop";

/** Upload an image to public storage and keep its URL in a hidden form field. */
export function ImageUrlField({ name, initial, label }: { name: string; initial?: string | null; label: string }) {
  const [url, setUrl] = useState(initial ?? "");
  return (
    <div>
      <p className="label">{label}</p>
      <input type="hidden" name={name} value={url} />
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-20 w-28 rounded-lg border border-line object-cover" />
          <button type="button" className="text-xs underline" onClick={() => setUrl("")}>Remove</button>
        </div>
      ) : (
        <FileDrop purpose="CONTENT_IMAGE" compact label="Upload image" onUploaded={(f) => setUrl(f.publicUrl ?? "")} />
      )}
      <p className="mt-1 text-[11px] text-charcoal/60">Remember to press Save below after uploading.</p>
    </div>
  );
}
