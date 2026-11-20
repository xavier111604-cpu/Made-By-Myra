import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, formatDate, orderNumber } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@/lib/labels";

export default async function AdminOverview() {
  await requireAdmin();
  const paid = { paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as ("PAID" | "PARTIALLY_REFUNDED" | "REFUNDED")[] } };
  const [totalOrders, revenue, refunds, awaitingDesign, awaitingApproval, toFulfil, quotes, unreadContacts, best, recent, subscribers] = await Promise.all([
    db.order.count({ where: paid }),
    db.payment.aggregate({ _sum: { amountCents: true } }),
    db.payment.aggregate({ _sum: { refundedCents: true } }),
    db.order.count({ where: { ...paid, status: "AWAITING_DESIGN" } }),
    db.order.count({ where: { ...paid, status: "AWAITING_APPROVAL" } }),
    db.order.count({ where: { paymentStatus: "PAID", status: { in: ["ORDER_RECEIVED", "IN_PRODUCTION"] } } }),
    db.designRequest.count({ where: { status: "QUOTE_REQUESTED" } }),
    db.contactMessage.count({ where: { handled: false } }),
    db.product.findMany({ where: { soldCount: { gt: 0 } }, orderBy: { soldCount: "desc" }, take: 5, select: { id: true, title: true, soldCount: true } }),
    db.order.findMany({ where: paid, orderBy: { createdAt: "desc" }, take: 8 }),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
  ]);
  // Revenue counts only payments confirmed by Stripe webhooks, minus refunds
  const net = (revenue._sum.amountCents ?? 0) - (refunds._sum.refundedCents ?? 0);

  const cards = [
    { label: "Paid orders", value: String(totalOrders), href: "/admin/orders" },
    { label: "Revenue (confirmed, net of refunds)", value: formatMoney(net), href: "/admin/orders" },
    { label: "Pending design requests", value: String(awaitingDesign), href: "/admin/orders?status=AWAITING_DESIGN" },
    { label: "Awaiting customer approval", value: String(awaitingApproval), href: "/admin/orders?status=AWAITING_APPROVAL" },
    { label: "Awaiting fulfillment", value: String(toFulfil), href: "/admin/orders?status=fulfil" },
    { label: "Quote requests", value: String(quotes), href: "/admin/requests" },
    { label: "Unhandled messages", value: String(unreadContacts), href: "/admin/requests" },
    { label: "Newsletter subscribers", value: String(subscribers), href: "/admin/content" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="heading-script text-5xl">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card p-5 transition hover:shadow-lift">
            <p className="text-xs uppercase tracking-wide text-charcoal/60">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-semibold">Recent paid orders</h2>
          <table className="admin-table mt-3 w-full">
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-medium underline">{orderNumber(o.number)}</Link><br /><span className="text-xs text-charcoal/60">{formatDate(o.createdAt)}</span></td>
                  <td>{o.customerName ?? o.email}</td>
                  <td>{ORDER_STATUS_LABEL[o.status]}</td>
                  <td>{formatMoney(o.totalCents, o.currency)}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={4} className="text-center text-charcoal/60">No paid orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Best sellers</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {best.map((p, i) => (
              <li key={p.id} className="flex justify-between"><span>{i + 1}. <Link href={`/admin/products/${p.id}`} className="underline">{p.title}</Link></span><span>{p.soldCount} sold</span></li>
            ))}
            {best.length === 0 && <li className="text-charcoal/60">Sales will appear here.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}
