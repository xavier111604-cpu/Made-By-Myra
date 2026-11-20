"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "./icons";
import { cn } from "@/lib/format";
import { UPLOAD_RULES, acceptAttr, humanTypes, type UploadPurposeKey } from "@/lib/upload-rules";

export type UploadedFile = {
  id: string;
  filename: string;
  contentType: string;
  previewUrl: string | null; // local object URL (images/SVG only)
  width?: number;
  height?: number;
  publicUrl?: string; // for public uploads (product/content images)
  key?: string;
};

function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload. Please check your connection and try again."));
    xhr.send(file);
  });
}

/** Uploads a file directly to secure storage with progress, then asks the server to verify it. */
export async function uploadFile(file: File, purpose: UploadPurposeKey, onProgress: (pct: number) => void): Promise<UploadedFile> {
  const rules = UPLOAD_RULES[purpose];
  if (!rules.types.includes(file.type)) throw new Error(`That file type isn't supported. Please use ${humanTypes(purpose)}.`);
  if (file.size > rules.maxBytes) throw new Error(`That file is too large. The limit is ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`);
  const dims = await readImageSize(file);

  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, filename: file.name, contentType: file.type, size: file.size, width: dims?.width, height: dims?.height }),
  });
  const p = await presign.json().catch(() => ({}));
  if (!presign.ok) throw new Error(p.error || "We couldn't start the upload. Please try again.");

  await putWithProgress(p.url, file, onProgress);

  const done = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId: p.uploadId }),
  });
  const d = await done.json().catch(() => ({}));
  if (!done.ok) throw new Error(d.error || "We couldn't verify that file. Please try another.");

  return {
    id: p.uploadId,
    filename: file.name,
    contentType: file.type,
    previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    width: dims?.width,
    height: dims?.height,
    publicUrl: d.publicUrl,
    key: d.key,
  };
}

export function FileDrop({
  purpose,
  onUploaded,
  label = "Upload a file",
  hint,
  multiple = false,
  compact = false,
}: {
  purpose: UploadPurposeKey;
  onUploaded: (f: UploadedFile) => void;
  label?: string;
  hint?: string;
  multiple?: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files).slice(0, multiple ? 5 : 1)) {
      try {
        setProgress(0);
        onUploaded(await uploadFile(file, purpose, setProgress));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setProgress(null);
      }
    }
    if (input.current) input.current.value = "";
  }

  const rules = UPLOAD_RULES[purpose];
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blush-dusty bg-cream text-center transition",
          compact ? "px-4 py-4" : "px-6 py-8",
          drag && "border-gold bg-blush/40",
        )}
      >
        <UploadIcon className="mb-2 text-gold" size={compact ? 20 : 28} />
        <button type="button" onClick={() => input.current?.click()} className="btn-primary btn-sm" disabled={progress !== null}>
          {progress !== null ? `Uploading… ${progress}%` : label}
        </button>
        <p className="mt-2 text-xs text-charcoal/60">
          {hint ?? `${humanTypes(purpose)} · up to ${Math.round(rules.maxBytes / 1024 / 1024)} MB`}
          {!compact && " · or drag & drop"}
        </p>
        <input ref={input} type="file" accept={acceptAttr(purpose)} multiple={multiple} className="sr-only" onChange={(e) => handle(e.target.files)} aria-label={label} />
        {progress !== null && (
          <div className="absolute inset-x-6 bottom-2 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
