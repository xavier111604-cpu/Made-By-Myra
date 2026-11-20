import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { findCart } from "@/lib/cart";
import { canAccessOrder } from "@/lib/orders";
import { presignGet, publicUrl } from "@/lib/storage";

/**
 * Authorized access to private files. Redirects to a short-lived signed URL only when the
 * viewer is allowed to see the file. Add ?dl=1 to download with the original filename.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const upload = await db.upload.findUnique({ where: { id } });
  if (!upload || upload.status !== "READY") return new NextResponse("Not found", { status: 404 });

  if (upload.isPublic) return NextResponse.redirect(publicUrl(upload.key));

  let allowed = false;
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") allowed = true;
  else if (sp.get("review") === "1" && upload.purpose === "REVIEW_PHOTO") {
    allowed = Boolean(await db.review.findFirst({ where: { photoUploadId: upload.id, approved: true } }));
  } else if (upload.orderId) {
    allowed = await canAccessOrder(upload.orderId, sp.get("t"));
  } else if (user && upload.userId === user.id) {
    allowed = true;
  } else {
    const cart = await findCart();
    allowed = Boolean(cart && upload.cartId === cart.id);
  }
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const url = await presignGet(upload.key, upload.filename, sp.get("dl") === "1");
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
