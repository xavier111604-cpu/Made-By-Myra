import type { Metadata } from "next";
import Link from "next/link";
import { getOrderForViewer } from "@/lib/orders";
import { formatMoney, orderNumber } from "@/lib/utils";
import { ScriptHeading, FloatingHearts } from "@/components/decor";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

/** Shows the order's real status from the database. Payment is confirmed only by the Stripe webhook. */
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string; t?: string }> }) {
  const { order: orderId, t } = await searchParams;
  const viewer = orderId ? await getOrderForViewer(orderId, t) : null;
  if (!viewer) {
    return (
      <div className="container-page py-20 text-center">
        <p>We couldn&apos;t find that order. If you were charged, please check your email or <Link href="/contact" className="underline">contact us</Link>.</p>
      </div>
    );
  }
  const { order } = viewer;
  const confirmed = order.paymentStatus === "PAID";
  const orderLink = order.userId ? `/account/orders/${order.id}` : `/order/${order.id}?t=${order.accessToken}`;

  return (
    <div className="container-page relative max-w-2xl py-16 text-center">
      <FloatingHearts />
      {confirmed ? (
        <>
          <ScriptHeading as="h1" brush className="text-6xl">Thank you ♡</ScriptHeading>
          <p className="mt-6 text-lg">Your order <strong>{orderNumber(order.number)}</strong> is confirmed.</p>
          <p className="mt-2 text-charcoal/70">
            We&apos;ve emailed a receipt to {order.email ?? "you"}. Total paid: {formatMoney(order.totalCents, order.currency)}.
          </p>
          {order.items.some((i) => i.requiresDesign) && (
            <p className="mt-4 rounded-2xl bg-cream p-4 text-sm">We&apos;ll start on your design and email you a proof to approve before anything is made.</p>
          )}
        </>
      ) : order.paymentStatus === "PENDING" ? (
        <>
          <AutoRefresh seconds={4} />
          <ScriptHeading as="h1" className="text-5xl">Almost there…</ScriptHeading>
          <p className="mt-6 text-charcoal/70">We&apos;re waiting for payment confirmation from Stripe. This page will update automatically.</p>
        </>
      ) : (
        <>
          <ScriptHeading as="h1" className="text-5xl">Payment not completed</ScriptHeading>
          <p className="mt-6 text-charcoal/70">Your payment wasn&apos;t completed. Your bag is still saved if you&apos;d like to try again.</p>
        </>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link href={orderLink} className="btn-primary">View your order</Link>
        <Link href="/shop" className="btn-secondary">Keep shopping</Link>
      </div>
      {!order.userId && confirmed && <p className="mt-6 text-xs text-charcoal/60">Bookmark your order link, or use the link in your email, to track your order and approve proofs.</p>}
    </div>
  );
}
