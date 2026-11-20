import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrderForViewer } from "@/lib/orders";
import { getPricingSettings } from "@/lib/content";
import { OrderView } from "@/components/order/order-view";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

/** Guest-friendly order page: accessible to the customer who placed it, or via the secret link emailed to them. */
export default async function GuestOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; revision?: string }> }) {
  const [{ id }, { t, revision }] = await Promise.all([params, searchParams]);
  const viewer = await getOrderForViewer(id, t);
  if (!viewer) notFound();
  const settings = await getPricingSettings();
  return (
    <div className="container-page max-w-4xl py-10">
      {revision === "paid" && <p className="mb-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Thank you — your revision request will be recorded as soon as payment is confirmed.</p>}
      <OrderView
        order={viewer.order}
        token={viewer.via === "token" ? t : undefined}
        canReorder={viewer.via === "owner"}
        includedRevisions={settings.includedRevisions}
        extraRevisionFeeCents={settings.extraRevisionFeeCents}
      />
    </div>
  );
}
