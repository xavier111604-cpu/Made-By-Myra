import Link from "next/link";
import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney, orderNumber } from "@/lib/utils";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";
import type { CustomizationSnapshot } from "@/lib/customization";

type SP = { q?: string; status?: string; payment?: string; sort?: string; dir?: string };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const where: Prisma.OrderWhereInput = {};
  const and: Prisma.OrderWhereInput[] = [];

  if (sp.payment === "all") {
    /* everything, including abandoned checkouts */
  } else if (sp.payment && sp.payment in PAYMENT_STATUS_LABEL) and.push({ paymentStatus: sp.payment as PaymentStatus });
  else and.push({ paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } });

  if (sp.status === "fulfil") and.push({ status: { in: ["ORDER_RECEIVED", "IN_PRODUCTION"] } });
  else if (sp.status && sp.status in ORDER_STATUS_LABEL) and.push({ status: sp.status as OrderStatus });

  const q = sp.q?.trim();
  if (q) {
    const num = parseInt(q.replace(/\D/g, ""), 10);
    and.push({
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { items: { some: { productTitle: { contains: q, mode: "insensitive" } } } },
        ...(Number.isFinite(num) ? [{ number: num - 1000 }, { number: num }] : []),
      ],
    });
  }
  if (and.length) where.AND = and;

  const dir = sp.dir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.OrderOrderByWithRelationInput = sp.sort === "total" ? { totalCents: dir } : sp.sort === "number" ? { number: dir } : { createdAt: dir };

  const orders = await db.order.findMany({ where, orderBy, take: 200, include: { items: true } });

  const sortLink = (key: string, label: string) => {
    const nextDir = sp.sort === key && dir === "desc" ? "asc" : "desc";
    const params = new URLSearchParams({ ...(sp as Record<string, string>), sort: key, dir: nextDir });
    return <Link href={`/admin/orders?${params}`} className="hover:underline">{label}{sp.sort === key ? (dir === "desc" ? " ↓" : " ↑") : ""}</Link>;
  };

  return (
    <div className="space-y-6">
      <h1 className="heading-script text-5xl">Orders</h1>
      <form className="card flex flex-wrap items-end gap-3 p-4 text-sm">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Order #, name, email or product" />
        </div>
        <div>
          <label htmlFor="status" className="label">Fulfillment</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">All</option>
            <option value="fulfil">Needs fulfillment</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="payment" className="label">Payment</label>
          <select id="payment" name="payment" defaultValue={sp.payment ?? ""} className="input">
            <option value="">Paid / refunded</option>
            <option value="all">All (incl. abandoned)</option>
            {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button className="btn-primary btn-sm">Filter</button>
        <Link href="/admin/orders" className="btn-ghost btn-sm">Reset</Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="admin-table w-full min-w-[900px]">
          <thead>
            <tr>
              <th>{sortLink("number", "Order")}</th>
              <th>{sortLink("date", "Date")}</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Payment</th>
              <th>Fulfillment</th>
              <th>{sortLink("total", "Total")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-cream/60">
                <td><Link href={`/admin/orders/${o.id}`} className="font-semibold underline">{orderNumber(o.number)}</Link></td>
                <td className="whitespace-nowrap">{formatDate(o.createdAt)}</td>
                <td>{o.customerName ?? "—"}<br /><span className="text-xs text-charcoal/60">{o.email}</span></td>
                <td>
                  {o.items.map((i) => {
                    const snap = i.customization as CustomizationSnapshot | null;
                    return (
                      <div key={i.id} className="text-xs">
                        {i.productTitle} · {i.colorName}/{i.sizeLabel} × {i.quantity}
                        {snap?.method === "UPLOAD" && <span className="ml-1 rounded bg-blush px-1">artwork</span>}
                        {snap?.method === "DESIGN_REQUEST" && <span className="ml-1 rounded bg-gold/20 px-1">design request</span>}
                      </div>
                    );
                  })}
                </td>
                <td>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</td>
                <td>{ORDER_STATUS_LABEL[o.status]}</td>
                <td className="whitespace-nowrap font-medium">{formatMoney(o.totalCents, o.currency)}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-charcoal/60">No orders match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
