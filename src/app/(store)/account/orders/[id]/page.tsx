import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderForViewer } from "@/lib/orders";
import { getPricingSettings } from "@/lib/content";
import { OrderView } from "@/components/order/order-view";

export default async function AccountOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getOrderForViewer(id);
  if (!viewer || viewer.via === "token") notFound();
  const settings = await getPricingSettings();
  return (
    <div>
      <Link href="/account" className="mb-4 inline-block text-sm text-charcoal/60 hover:underline">← All orders</Link>
      <OrderView order={viewer.order} canReorder={viewer.via === "owner"} includedRevisions={settings.includedRevisions} extraRevisionFeeCents={settings.extraRevisionFeeCents} />
    </div>
  );
}
