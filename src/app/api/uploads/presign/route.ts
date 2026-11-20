import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCart } from "@/lib/cart";
import { limitByIp } from "@/lib/rate-limit";
import { presignPut, storageConfigured } from "@/lib/storage";
import { UPLOAD_RULES, extensionFor, type UploadPurposeKey } from "@/lib/upload-rules";
import { randomToken } from "@/lib/utils";

const schema = z.object({
  purpose: z.enum(Object.keys(UPLOAD_RULES) as [UploadPurposeKey, ...UploadPurposeKey[]]),
  filename: z.string().min(1).max(200),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
  width: z.number().int().positive().max(40000).optional(),
  height: z.number().int().positive().max(40000).optional(),
});

export async function POST(req: Request) {
  if (!storageConfigured) {
    return NextResponse.json({ error: "File uploads aren't set up yet. Please contact us and we'll help with your order." }, { status: 503 });
  }
  if (!(await limitByIp("upload", 40, 10 * 60))) {
    return NextResponse.json({ error: "Too many uploads in a short time. Please wait a few minutes." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  const { purpose, filename, contentType, size, width, height } = parsed.data;
  const rules = UPLOAD_RULES[purpose];

  if (!rules.types.includes(contentType)) return NextResponse.json({ error: "That file type isn't supported." }, { status: 400 });
  if (size > rules.maxBytes) return NextResponse.json({ error: `That file is too large (limit ${Math.round(rules.maxBytes / 1048576)} MB).` }, { status: 400 });

  const user = await getCurrentUser();
  if (rules.adminOnly && user?.role !== "ADMIN") return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  // Customer uploads are tied to their cart (guests) and account (if signed in)
  const cart = rules.adminOnly ? null : await getOrCreateCart();
  const now = new Date();
  const key = `${purpose.toLowerCase()}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomToken(16)}.${extensionFor(contentType)}`;

  const upload = await db.upload.create({
    data: {
      key,
      isPublic: rules.isPublic,
      purpose,
      filename: filename.replace(/[^\w.\- ()]/g, "_").slice(0, 150),
      contentType,
      size,
      width,
      height,
      userId: user?.id,
      cartId: cart?.id,
    },
  });

  const url = await presignPut(key, contentType, rules.isPublic);
  return NextResponse.json({ uploadId: upload.id, url });
}
