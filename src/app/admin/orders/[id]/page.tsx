import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { orderDetailInclude } from "@/lib/orders";
import { formatDateTime, formatMoney, orderNumber } from "@/lib/utils";
import { CARRIER_LABEL, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, trackingLink } from "@/lib/labels";
import type { CustomizationSnapshot } from "@/lib/customization";
import { addShipment, cancelOrder, markDelivered, saveInternalNotes, updateOrderStatus } from "@/actions/admin-orders";
import { ProofUploader, RefundForm } from "@/components/admin/order-tools";
import { MessageThread } from "@/components/order/message-thread";
import { Address } from "@/components/order/order-view";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { ...orderDetailInclude, user: { select: { email: true, name: true } } } });
  if (!order) notFound();

  const file = (uploadId: string, dl = false) => `/api/files/${uploadId}${dl ? "?dl=1" : ""}`;
  const allInspiration = order.items.flatMap((i) => i.designRequest?.inspirationUploadIds ?? []);
  const uploads = await db.upload.findMany({ where: { id: { in: [...order.items.flatMap((i) => i.artworks.map((a) => a.uploadId)), ...allInspiration] } } });
  const uploadById = new Map(uploads.map((u) => [u.id, u]));
  const isPaid = ["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm text-charcoal/60 hover:underline">← Orders</Link>
          <h1 className="mt-1 text-2xl font-semibold">Order {orderNumber(order.number)}</h1>
          <p className="text-sm text-charcoal/60">
            {formatDateTime(order.createdAt)} · <strong>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</strong> · {ORDER_STATUS_LABEL[order.status]}
          </p>
        </div>
        <Link href={`/admin/orders/${order.id}/packing-slip`} className="btn-secondary btn-sm" target="_blank">Print packing slip</Link>
      </div>

      {!isPaid && order.paymentStatus === "PENDING" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Payment has not been confirmed by Stripe. Do not start production on this order.</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {order.items.map((item) => {
            const snap = item.customization as CustomizationSnapshot | null;
            return (
              <section key={item.id} className="card p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{item.productTitle}</p>
                    <p className="text-sm">Color <strong>{item.colorName}</strong> · Size <strong>{item.sizeLabel}</strong> · Qty <strong>{item.quantity}</strong></p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatMoney(item.lineTotalCents, order.currency)}</p>
                    <p className="text-xs text-charcoal/60">
                      {formatMoney(item.unitPriceCents)} + {formatMoney(item.customizationCents)} custom / unit{item.designFeeCents ? ` + ${formatMoney(item.designFeeCents)} design` : ""}
                    </p>
                  </div>
                </div>

                {snap?.method === "UPLOAD" && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold">Customer artwork</p>
                    {snap.placements.map((p, i) => {
                      const up = p.uploadId ? uploadById.get(p.uploadId) : undefined;
                      return (
                        <div key={i} className="flex flex-wrap items-center gap-4 rounded-xl bg-cream p-3 text-sm">
                          {p.uploadId && up?.contentType.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={file(p.uploadId)} alt="" className="h-20 w-20 rounded-lg bg-white object-contain" />
                          ) : null}
                          <div className="flex-1">
                            <p><strong>{p.locationName}</strong>{p.filename && ` · ${p.filename}`}</p>
                            {up && <p className="text-xs text-charcoal/60">{up.contentType} · {(up.size / 1048576).toFixed(1)} MB{up.width ? ` · ${up.width}×${up.height}px` : ""}</p>}
                            <p className="text-xs text-charcoal/60">Position {Math.round(p.x * 100)}% / {Math.round(p.y * 100)}% · size {Math.round(p.scale * 100)}% of print area</p>
                            {p.text && <p className="text-xs">Text: “{p.text}” ({p.textFont === "sans" ? "clean" : "handwritten"}, {p.textColor})</p>}
                          </div>
                          {p.uploadId && <a href={file(p.uploadId, true)} className="btn-primary btn-sm">Download original</a>}
                        </div>
                      );
                    })}
                    {snap.instructions && <p className="rounded-xl border border-line p-3 text-sm"><strong>Instructions:</strong> {snap.instructions}</p>}
                  </div>
                )}

                {item.designRequest && (
                  <div className="mt-4 space-y-2 rounded-xl border border-gold/40 bg-white p-4 text-sm">
                    <p className="font-semibold">Design request</p>
                    <p className="whitespace-pre-line">{item.designRequest.description}</p>
                    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                      {[
                        ["Text to include", item.designRequest.textToInclude],
                        ["Preferred colors", item.designRequest.preferredColors],
                        ["Style", item.designRequest.style],
                        ["Placement", item.designRequest.placement],
                        ["Occasion", item.designRequest.occasion],
                        ["Notes", item.designRequest.notes],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline">{v}</dd></div>
                      ))}
                    </dl>
                    {item.designRequest.inspirationUploadIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {item.designRequest.inspirationUploadIds.map((uid) => (
                          <a key={uid} href={file(uid, true)} title="Download inspiration image">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={file(uid)} alt="Inspiration" className="h-20 w-20 rounded-lg border border-line object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {item.requiresDesign && (
                  <div className="mt-4 border-t border-line pt-4">
                    <p className="mb-2 text-sm font-semibold">Proofs · {item.revisionsUsed} revision(s) used · {item.designApproved ? "✅ approved" : "not yet approved"}</p>
                    <div className="mb-3 flex flex-wrap gap-3">
                      {item.proofs.map((p) => (
                        <a key={p.id} href={file(p.uploadId)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-line p-2 text-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={file(p.uploadId)} alt="" className="mb-1 h-24 w-24 rounded bg-white object-contain" />
                          v{p.version} · {p.status.replace("_", " ").toLowerCase()}
                          {p.customerComment && <span className="block max-w-[6rem] truncate" title={p.customerComment}>“{p.customerComment}”</span>}
                        </a>
                      ))}
                    </div>
                    {isPaid && <ProofUploader orderItemId={item.id} />}
                  </div>
                )}
              </section>
            );
          })}

          <MessageThread
            asOwner
            orderId={order.id}
            messages={order.messages.map((m) => ({ id: m.id, author: m.author, body: m.body, createdAt: m.createdAt.toISOString(), fileUrl: m.uploadId ? file(m.uploadId) : null }))}
          />

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">History</h2>
            <ul className="space-y-1.5 text-sm">
              {order.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-44 shrink-0 text-charcoal/50">{formatDateTime(e.createdAt)}</span>
                  <span>{e.message}{!e.visibleToCustomer && <em className="text-charcoal/50"> (internal)</em>}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card space-y-3 p-5 text-sm">
            <h2 className="font-semibold">Customer</h2>
            <p>{order.customerName ?? "—"}<br />{order.email}<br />{order.phone}</p>
            <p className="text-xs text-charcoal/60">{order.userId ? "Has an account" : "Guest checkout"}</p>
            {order.shippingAddress && (<><h3 className="pt-2 font-semibold">Ship to</h3><Address a={order.shippingAddress as Record<string, string | null>} /></>)}
          </section>

          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold">Update status</h2>
            <form action={updateOrderStatus} className="space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <select name="status" defaultValue={order.status} className="input">
                {Object.entries(ORDER_STATUS_LABEL).filter(([k]) => k !== "CANCELLED").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="flex items-center gap-2"><input type="checkbox" name="notify" defaultChecked className="accent-[#E8B5C0]" /> Email the customer</label>
              <button className="btn-primary btn-sm w-full">Save status</button>
            </form>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold">Shipping & tracking</h2>
            {order.shipments.map((s) => {
              const link = trackingLink(s.carrier, s.trackingNumber, s.trackingUrl);
              return <p key={s.id} className="mb-2">{CARRIER_LABEL[s.carrier]} · {link ? <a href={link} className="underline" target="_blank" rel="noopener noreferrer">{s.trackingNumber}</a> : s.trackingNumber}{s.deliveredAt && " · delivered"}</p>;
            })}
            <form action={addShipment} className="space-y-2">
              <input type="hidden" name="orderId" value={order.id} />
              <select name="carrier" className="input" aria-label="Carrier">{Object.entries(CARRIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input name="trackingNumber" className="input" placeholder="Tracking number" required aria-label="Tracking number" />
              <input name="trackingUrl" className="input" placeholder="Tracking URL (only for 'Other')" aria-label="Tracking URL" />
              <button className="btn-primary btn-sm w-full">Add tracking & mark shipped</button>
            </form>
            {order.status === "SHIPPED" && (
              <form action={markDelivered} className="mt-2"><input type="hidden" name="orderId" value={order.id} /><button className="btn-secondary btn-sm w-full">Mark delivered</button></form>
            )}
          </section>

          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold">Payments & refunds</h2>
            <dl className="mb-3 space-y-1">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotalCents)}</dd></div>
              {order.discountCents > 0 && <div className="flex justify-between"><dt>Discount {order.discountCode?.code}</dt><dd>−{formatMoney(order.discountCents)}</dd></div>}
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatMoney(order.shippingCents)}</dd></div>
              <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(order.taxCents)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Total</dt><dd>{formatMoney(order.totalCents)}</dd></div>
            </dl>
            {order.payments.map((p) => (
              <div key={p.id} className="mb-3 rounded-xl bg-cream p-3">
                <p className="font-medium">{p.type === "ORDER" ? "Order payment" : "Revision fee"} · {formatMoney(p.amountCents)}</p>
                <p className="text-xs text-charcoal/60">Refunded {formatMoney(p.refundedCents)} · {p.status}</p>
                {p.refundedCents < p.amountCents && <RefundForm orderId={order.id} paymentId={p.id} maxCents={p.amountCents - p.refundedCents} />}
              </div>
            ))}
            {order.payments.length === 0 && <p className="text-charcoal/60">No confirmed payments.</p>}
          </section>

          {order.status !== "CANCELLED" && (
            <section className="card p-5 text-sm">
              <h2 className="mb-2 font-semibold">Cancel order</h2>
              <form action={cancelOrder} className="space-y-2">
                <input type="hidden" name="orderId" value={order.id} />
                <label className="flex items-center gap-2"><input type="checkbox" name="restock" defaultChecked className="accent-[#E8B5C0]" /> Return items to stock</label>
                <p className="text-xs text-charcoal/60">Cancelling does not refund automatically — issue a refund above if needed.</p>
                <button className="btn-secondary btn-sm w-full border-red-300 text-red-700">Cancel order</button>
              </form>
            </section>
          )}

          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Private notes</h2>
            <form action={saveInternalNotes} className="space-y-2">
              <input type="hidden" name="orderId" value={order.id} />
              <textarea name="notes" defaultValue={order.internalNotes ?? ""} className="input min-h-24" aria-label="Private notes" />
              <button className="btn-ghost btn-sm">Save notes</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
