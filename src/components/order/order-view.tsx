import Link from "next/link";
import type { OrderDetail } from "@/lib/orders";
import type { CustomizationSnapshot } from "@/lib/customization";
import { formatDate, formatDateTime, formatMoney, orderNumber } from "@/lib/format";
import { CARRIER_LABEL, PAYMENT_STATUS_LABEL, trackingLink } from "@/lib/labels";
import { StatusTimeline } from "./status-timeline";
import { ProofResponse } from "./proof-response";
import { MessageThread } from "./message-thread";
import { ReorderButton } from "./reorder-button";
import { FileIcon } from "../icons";

/** Customer view of an order. `token` is appended to file links so guests can see their files. */
export function OrderView({ order, token, canReorder, includedRevisions, extraRevisionFeeCents }: {
  order: OrderDetail;
  token?: string;
  canReorder: boolean;
  includedRevisions: number;
  extraRevisionFeeCents: number;
}) {
  const q = token ? `?t=${token}` : "";
  const fileUrl = (id: string) => `/api/files/${id}${q}`;
  const hasDesign = order.items.some((i) => i.requiresDesign);
  const pendingPayment = order.paymentStatus === "PENDING";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Order {orderNumber(order.number)}</h1>
          <p className="text-sm text-charcoal/60">Placed {formatDate(order.createdAt)} · {PAYMENT_STATUS_LABEL[order.paymentStatus]}</p>
        </div>
        {canReorder && order.paymentStatus === "PAID" && <ReorderButton orderId={order.id} />}
      </div>

      {pendingPayment ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">We haven&apos;t received payment confirmation for this order yet.</p>
      ) : (
        <div className="card p-5">
          <StatusTimeline status={order.status} hasDesign={hasDesign} />
        </div>
      )}

      {order.shipments.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-2 font-semibold">Shipping</h2>
          {order.shipments.map((s) => {
            const link = trackingLink(s.carrier, s.trackingNumber, s.trackingUrl);
            return (
              <p key={s.id} className="text-sm">
                {CARRIER_LABEL[s.carrier]} ·{" "}
                {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="font-medium text-gold underline">{s.trackingNumber}</a> : s.trackingNumber} · shipped {formatDate(s.shippedAt)}
                {s.deliveredAt && ` · delivered ${formatDate(s.deliveredAt)}`}
              </p>
            );
          })}
        </div>
      )}

      <div className="space-y-5">
        {order.items.map((item) => {
          const snap = item.customization as CustomizationSnapshot | null;
          const latest = item.proofs[item.proofs.length - 1];
          return (
            <div key={item.id} className="card p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.productTitle}</p>
                  <p className="text-sm text-charcoal/60">{item.colorName} · {item.sizeLabel} · Qty {item.quantity}</p>
                </div>
                <p className="font-semibold">{formatMoney(item.lineTotalCents, order.currency)}</p>
              </div>

              {snap?.method === "UPLOAD" && (
                <div className="mt-4 space-y-2 text-sm">
                  {snap.placements.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {p.uploadId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(p.uploadId)} alt="" className="h-12 w-12 rounded-lg border border-line bg-white object-contain" loading="lazy" />
                      ) : (
                        <span className="grid h-12 w-12 place-items-center rounded-lg bg-cream"><FileIcon /></span>
                      )}
                      <span>
                        <strong>{p.locationName}</strong>
                        {p.filename && ` · ${p.filename}`}
                        {p.text && ` · text “${p.text}”`}
                      </span>
                    </div>
                  ))}
                  {snap.instructions && <p className="text-charcoal/70">Notes: {snap.instructions}</p>}
                </div>
              )}

              {snap?.method === "DESIGN_REQUEST" && (
                <div className="mt-4 rounded-xl bg-cream p-4 text-sm">
                  <p className="font-medium">Your design request</p>
                  <p className="mt-1 whitespace-pre-line text-charcoal/80">{snap.request.description}</p>
                  <ul className="mt-2 space-y-0.5 text-xs text-charcoal/70">
                    {snap.request.textToInclude && <li>Text: {snap.request.textToInclude}</li>}
                    {snap.request.preferredColors && <li>Colors: {snap.request.preferredColors}</li>}
                    {snap.request.style && <li>Style: {snap.request.style}</li>}
                    {snap.request.placementName && <li>Placement: {snap.request.placementName}</li>}
                    {snap.request.occasion && <li>Occasion: {snap.request.occasion}</li>}
                  </ul>
                </div>
              )}

              {item.requiresDesign && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-sm font-semibold">Design proof</p>
                  {!latest && <p className="text-sm text-charcoal/60">We&apos;re working on your design. You&apos;ll get an email when your proof is ready.</p>}
                  {item.proofs.map((proof) => (
                    <div key={proof.id} className="mb-4 rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">Proof v{proof.version} · {formatDate(proof.createdAt)}</span>
                        <span className="chip">{proof.status === "PENDING_REVIEW" ? "Awaiting your approval" : proof.status === "APPROVED" ? "Approved ♡" : "Revision requested"}</span>
                      </div>
                      <a href={fileUrl(proof.uploadId)} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl(proof.uploadId)} alt={`Design proof version ${proof.version}`} className="max-h-80 rounded-lg border border-line bg-white object-contain" />
                      </a>
                      {proof.ownerNote && <p className="mt-2 text-sm text-charcoal/80">Note from Myra: {proof.ownerNote}</p>}
                      {proof.customerComment && <p className="mt-1 text-sm text-charcoal/60">Your comment: {proof.customerComment}</p>}
                      {proof.id === latest?.id && proof.status === "PENDING_REVIEW" && (
                        <ProofResponse
                          orderId={order.id}
                          token={token}
                          proofId={proof.id}
                          revisionsLeft={Math.max(0, includedRevisions - item.revisionsUsed)}
                          extraFeeCents={extraRevisionFeeCents}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canReorder && order.paymentStatus === "PAID" && !item.review && item.product?.slug && (
                <Link href={`/products/${item.product.slug}#reviews`} className="mt-3 inline-block text-xs font-medium text-gold underline">
                  Leave a review
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-5 text-sm">
          <h2 className="mb-3 font-semibold">Summary</h2>
          <dl className="space-y-1">
            <Row k="Subtotal" v={formatMoney(order.subtotalCents, order.currency)} />
            {order.discountCents > 0 && <Row k={`Discount${order.discountCode ? ` (${order.discountCode.code})` : ""}`} v={`−${formatMoney(order.discountCents, order.currency)}`} />}
            <Row k="Shipping" v={formatMoney(order.shippingCents, order.currency)} />
            {order.taxCents > 0 && <Row k="Tax" v={formatMoney(order.taxCents, order.currency)} />}
            <Row k="Total" v={formatMoney(order.totalCents, order.currency)} bold />
          </dl>
        </div>
        {order.shippingAddress && (
          <div className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold">Shipping to</h2>
            <Address a={order.shippingAddress as Record<string, string | null>} />
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">History</h2>
        <ul className="space-y-2 text-sm">
          {order.events.filter((e) => e.visibleToCustomer).map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="w-40 shrink-0 text-charcoal/50">{formatDateTime(e.createdAt)}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      </div>

      <MessageThread orderId={order.id} token={token} messages={order.messages.map((m) => ({ id: m.id, author: m.author, body: m.body, createdAt: m.createdAt.toISOString(), fileUrl: m.uploadId ? fileUrl(m.uploadId) : null }))} />
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-line pt-2 font-semibold" : ""}`}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

export function Address({ a }: { a: Record<string, string | null> }) {
  return (
    <address className="not-italic leading-relaxed">
      {a.name && <>{a.name}<br /></>}
      {a.line1}
      {a.line2 && <>, {a.line2}</>}
      <br />
      {a.city}, {a.state} {a.postalCode}
      <br />
      {a.country}
    </address>
  );
}
