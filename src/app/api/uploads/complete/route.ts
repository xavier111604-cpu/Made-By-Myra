import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { findCart } from "@/lib/cart";
import { deleteObject, headObject, publicUrl, readObjectBytes } from "@/lib/storage";
import { matchesSignature, svgIsSafe } from "@/lib/file-validation";
import { UPLOAD_RULES, type UploadPurposeKey } from "@/lib/upload-rules";

const schema = z.object({ uploadId: z.string().max(40) });

/** Verifies an uploaded object: real size, real file signature, and SVG safety. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const upload = await db.upload.findUnique({ where: { id: parsed.data.uploadId } });
  if (!upload || upload.status !== "PENDING") return NextResponse.json({ error: "Upload not found." }, { status: 404 });

  const [user, cart] = await Promise.all([getCurrentUser(), findCart()]);
  const owns = user?.role === "ADMIN" || (user && upload.userId === user.id) || (cart && upload.cartId === cart.id);
  if (!owns) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const rules = UPLOAD_RULES[upload.purpose as UploadPurposeKey];
  const reject = async (msg: string) => {
    await deleteObject(upload.key, upload.isPublic).catch(() => {});
    await db.upload.update({ where: { id: upload.id }, data: { status: "REJECTED" } });
    return NextResponse.json({ error: msg }, { status: 400 });
  };

  try {
    const head = await headObject(upload.key, upload.isPublic);
    const size = Number(head.ContentLength ?? 0);
    if (!size) return reject("The upload didn't complete. Please try again.");
    if (size > rules.maxBytes) return reject("That file is too large.");

    if (upload.contentType === "image/svg+xml") {
      const full = await readObjectBytes(upload.key, upload.isPublic);
      if (!matchesSignature(upload.contentType, full)) return reject("That file doesn't look like a valid SVG.");
      const safe = svgIsSafe(full);
      if (!safe.ok) return reject(safe.reason!);
    } else {
      const first = await readObjectBytes(upload.key, upload.isPublic, "bytes=0-63");
      if (!matchesSignature(upload.contentType, first)) return reject("That file's contents don't match its type. Please export it again as PNG, JPG or PDF.");
    }

    await db.upload.update({ where: { id: upload.id }, data: { status: "READY", size } });
    return NextResponse.json({ ok: true, key: upload.key, publicUrl: upload.isPublic ? publicUrl(upload.key) : undefined });
  } catch (err) {
    console.error("upload verify failed", err);
    return NextResponse.json({ error: "We couldn't verify your file. Please try again." }, { status: 500 });
  }
}
