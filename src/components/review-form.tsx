"use client";

import { useState, useTransition } from "react";
import { StarIcon } from "./icons";
import { FileDrop, type UploadedFile } from "./file-drop";
import { submitReview } from "@/actions/reviews";
import { cn } from "@/lib/format";

export function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<UploadedFile | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (msg?.ok) return <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{msg.text}</p>;

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitReview({ productId, rating, title, body, photoUploadId: photo?.id });
          setMsg(res.ok ? { ok: true, text: "Thank you! Your review will appear once it's been approved ♡" } : { ok: false, text: res.error });
        });
      }}
    >
      <h3 className="heading-script text-3xl">Leave a review</h3>
      <fieldset>
        <legend className="label">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating === n} className={cn("text-gold transition hover:scale-110")}>
              <StarIcon size={26} filled={n <= rating} />
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="rv-title" className="label">Title (optional)</label>
        <input id="rv-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="rv-body" className="label">Your review</label>
        <textarea id="rv-body" className="input min-h-28" required minLength={10} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div>
        <p className="label">Add a photo (optional)</p>
        {photo ? (
          <p className="text-sm">
            {photo.filename}{" "}
            <button type="button" className="underline" onClick={() => setPhoto(null)}>Remove</button>
          </p>
        ) : (
          <FileDrop purpose="REVIEW_PHOTO" compact label="Upload photo" onUploaded={setPhoto} />
        )}
      </div>
      {msg && !msg.ok && <p className="text-sm text-red-700" role="alert">{msg.text}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Submit review"}</button>
    </form>
  );
}
