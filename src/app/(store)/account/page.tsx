import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, orderNumber } from "@/lib/utils";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";

export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const orders = await db.order.findMany({
    where: {
      userId: user.id,
      paymentStatus: { notIn: ["PENDING", "CANCELLED"] },
      ...(filter === "proofs" ? { items: { some: { proofs: { some: { status: "PENDING_REVIEW" } } } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { productTitle: true, quantity: true, proofs: { where: { status: "PENDING_REVIEW" }, select: { id: true } } } } },
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{filter === "proofs" ? "Designs waiting for your approval" : "Your orders"}</h2>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-charcoal/60">
          {filter === "proofs" ? "Nothing to approve right now." : <>No orders yet. <Link href="/customize" className="underline">Start something special ♡</Link></>}
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const awaiting = o.items.some((i) => i.proofs.length > 0);
            return (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:shadow-lift">
                  <div>
                    <p className="font-semibold">{orderNumber(o.number)} <span className="font-normal text-charcoal/60">· {formatDate(o.createdAt)}</span></p>
                    <p className="text-sm text-charcoal/70">{o.items.map((i) => `${i.productTitle} × ${i.quantity}`).join(", ")}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatMoney(o.totalCents, o.currency)}</p>
                    <p className="text-charcoal/60">{o.paymentStatus === "PAID" ? ORDER_STATUS_LABEL[o.status] : PAYMENT_STATUS_LABEL[o.paymentStatus]}</p>
                    {awaiting && <span className="chip mt-1 border-gold text-gold">Proof ready to review</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
