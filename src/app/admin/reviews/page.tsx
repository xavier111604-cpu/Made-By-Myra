import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { moderateReview } from "@/actions/admin-settings";

export default async function ReviewsPage() {
  await requireAdmin();
  const reviews = await db.review.findMany({
    orderBy: [{ approved: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true, email: true } }, product: { select: { title: true, slug: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="heading-script text-5xl">Reviews</h1>
      <p className="text-sm text-charcoal/70">Only verified purchasers can submit reviews. New reviews stay hidden until you approve them.</p>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="card flex flex-wrap gap-4 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} {r.title}</p>
              <p className="mt-1 whitespace-pre-line">{r.body}</p>
              <p className="mt-2 text-xs text-charcoal/60">
                {r.user.name ?? r.user.email} · <Link href={`/products/${r.product.slug}`} className="underline">{r.product.title}</Link> · {formatDate(r.createdAt)} · {r.approved ? "Visible" : "Awaiting approval"}
              </p>
            </div>
            {r.photoUploadId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${r.photoUploadId}`} alt="Customer photo" className="h-24 w-24 rounded-xl object-cover" />
            )}
            <form action={moderateReview} className="flex items-start gap-2">
              <input type="hidden" name="id" value={r.id} />
              {!r.approved && <button name="action" value="approve" className="btn-primary btn-sm">Approve</button>}
              {r.approved && <button name="action" value="hide" className="btn-secondary btn-sm">Hide</button>}
              <button name="action" value="delete" className="btn-ghost btn-sm text-red-700">Delete</button>
            </form>
          </div>
        ))}
        {reviews.length === 0 && <p className="text-charcoal/60">No reviews yet.</p>}
      </div>
    </div>
  );
}
