import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDate, orderNumber } from "@/lib/utils";
import type { CustomizationSnapshot } from "@/lib/customization";
import { Address } from "@/components/order/order-view";
import { PrintButton } from "@/components/admin/print-button";

export default async function PackingSlip({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-sm print:p-0">
      <div className="no-print mb-6"><PrintButton /></div>
      <div className="flex items-start justify-between border-b border-line pb-4">
        <div>
          <p className="heading-script text-4xl">Made by Myra ♡</p>
          <p className="text-xs uppercase tracking-widest">Custom apparel · Gifts · Accessories</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Packing slip</p>
          <p>{orderNumber(order.number)}</p>
          <p>{formatDate(order.createdAt)}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="font-semibold">Ship to</p>
        {order.shippingAddress ? <Address a={order.shippingAddress as Record<string, string | null>} /> : <p>{order.customerName}</p>}
      </div>
      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b border-charcoal text-left"><th className="py-2">Item</th><th>Color</th><th>Size</th><th className="text-right">Qty</th></tr>
        </thead>
        <tbody>
          {order.items.map((i) => {
            const snap = i.customization as CustomizationSnapshot | null;
            return (
              <tr key={i.id} className="border-b border-line align-top">
                <td className="py-2">
                  {i.productTitle}
                  {snap?.method === "UPLOAD" && <div className="text-xs">Custom print: {snap.placements.map((p) => p.locationName).join(", ")}</div>}
                  {snap?.method === "DESIGN_REQUEST" && <div className="text-xs">Custom design (approved proof)</div>}
                </td>
                <td>{i.colorName}</td>
                <td>{i.sizeLabel}</td>
                <td className="text-right">{i.quantity}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="heading-script mt-10 text-center text-2xl">Thank you for supporting a small business ♡</p>
    </div>
  );
}
