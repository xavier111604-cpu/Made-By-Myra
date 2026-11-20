import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3-compatible object storage. Works with AWS S3, Cloudflare R2, Supabase Storage (S3 endpoint),
 * Backblaze B2, etc.
 *   - PRIVATE bucket: customer artwork, inspiration images, proofs, attachments (never public)
 *   - PUBLIC bucket: product photos, mockups, homepage/about images
 */

export const storageConfigured = Boolean(
  process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_PRIVATE_BUCKET && process.env.S3_PUBLIC_BUCKET,
);

let s3: S3Client | null = null;
function client() {
  if (!storageConfigured) throw new Error("File storage is not configured. Set the S3_* variables in your environment.");
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3;
}

export function bucketFor(isPublic: boolean) {
  return isPublic ? process.env.S3_PUBLIC_BUCKET! : process.env.S3_PRIVATE_BUCKET!;
}

export function publicUrl(key: string) {
  const base = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function presignPut(key: string, contentType: string, isPublic: boolean) {
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: bucketFor(isPublic), Key: key, ContentType: contentType }), {
    expiresIn: 60 * 10,
  });
}

export async function presignGet(key: string, filename?: string, download = false) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucketFor(false),
      Key: key,
      ResponseContentDisposition: filename
        ? `${download ? "attachment" : "inline"}; filename="${filename.replace(/[^\w.\- ]/g, "_")}"`
        : undefined,
    }),
    { expiresIn: 60 * 5 },
  );
}

export async function headObject(key: string, isPublic: boolean) {
  return client().send(new HeadObjectCommand({ Bucket: bucketFor(isPublic), Key: key }));
}

export async function readObjectBytes(key: string, isPublic: boolean, range?: string) {
  const res = await client().send(new GetObjectCommand({ Bucket: bucketFor(isPublic), Key: key, Range: range }));
  const bytes = await res.Body?.transformToByteArray();
  return Buffer.from(bytes ?? []);
}

export async function deleteObject(key: string, isPublic: boolean) {
  await client().send(new DeleteObjectCommand({ Bucket: bucketFor(isPublic), Key: key }));
}
