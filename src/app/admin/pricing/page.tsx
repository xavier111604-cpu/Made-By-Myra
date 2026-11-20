import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getPricingSettings } from "@/lib/content";
import { centsToDollars, formatDate } from "@/lib/utils";
import { deleteDiscount, deleteShippingRate, saveDiscount, savePricingSettings, saveShippingRate } from "@/actions/admin-settings";

export default async function PricingPage() {
  await requireAdmin();
  const [settings, rates, discounts] = await Promise.all([
    getPricingSettings(),
    db.shippingRate.findMany({ orderBy: { sortOrder: "asc" } }),
    db.discountCode.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="heading-script text-5xl">Pricing, shipping & discounts</h1>
      <p className="text-sm text-charcoal/70">Base prices, size surcharges, variant prices and print-placement prices are edited on each product.</p>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Design service</h2>
        <form action={savePricingSettings} className="grid gap-4 text-sm sm:grid-cols-4">
          <label><span className="label">Default design fee ($)</span><input name="designFee" defaultValue={centsToDollars(settings.designFeeCents)} className="input" inputMode="decimal" /></label>
          <label><span className="label">Included revisions</span><input name="includedRevisions" type="number" min={0} max={20} defaultValue={settings.includedRevisions} className="input" /></label>
          <label><span className="label">Extra revision fee ($)</span><input name="extraRevisionFee" defaultValue={centsToDollars(settings.extraRevisionFeeCents)} className="input" inputMode="decimal" /></label>
          <div className="self-end"><button className="btn-primary btn-sm">Save</button></div>
        </form>
        <p className="mt-2 text-xs text-charcoal/60">Set the extra revision fee to 0 to allow unlimited free revisions.</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Shipping rates</h2>
        <p className="mb-3 text-xs text-charcoal/60">Shown to customers at Stripe checkout (up to 5 active rates). “Free over” makes a rate free when the discounted subtotal reaches that amount.</p>
        <div className="space-y-3">
          {[...rates, null].map((r, i) => (
            <form key={r?.id ?? `new-${i}`} action={saveShippingRate} className="grid items-end gap-2 rounded-xl border border-line p-3 text-sm md:grid-cols-[2fr_1fr_1fr_0.7fr_0.7fr_0.6fr_auto_auto]">
              <input type="hidden" name="id" value={r?.id ?? ""} />
              <label><span className="label">{r ? "Name" : "New rate name"}</span><input name="name" defaultValue={r?.name} className="input" required placeholder="Standard shipping" /></label>
              <label><span className="label">Price ($)</span><input name="amount" defaultValue={r ? centsToDollars(r.amountCents) : ""} className="input" inputMode="decimal" required /></label>
              <label><span className="label">Free over ($)</span><input name="freeOver" defaultValue={centsToDollars(r?.freeOverCents)} className="input" inputMode="decimal" /></label>
              <label><span className="label">Min days</span><input name="minDays" defaultValue={r?.minDays ?? ""} className="input" type="number" /></label>
              <label><span className="label">Max days</span><input name="maxDays" defaultValue={r?.maxDays ?? ""} className="input" type="number" /></label>
              <label><span className="label">Order</span><input name="sortOrder" defaultValue={r?.sortOrder ?? 0} className="input" type="number" /></label>
              <label className="flex items-center gap-1 pb-2"><input type="checkbox" name="active" defaultChecked={r?.active ?? true} /> Active</label>
              <div className="flex gap-2"><button className="btn-primary btn-sm">{r ? "Save" : "Add"}</button></div>
            </form>
          ))}
        </div>
        {rates.map((r) => (
          <form key={r.id} action={deleteShippingRate} className="mt-1 inline-block pr-3">
            <input type="hidden" name="id" value={r.id} />
            <button className="text-xs text-red-700 underline">Delete “{r.name}”</button>
          </form>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Discount codes</h2>
        <div className="space-y-3">
          {[...discounts, null].map((d, i) => (
            <form key={d?.id ?? `new-${i}`} action={saveDiscount} className="grid items-end gap-2 rounded-xl border border-line p-3 text-sm md:grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr_1.1fr_auto_auto]">
              <input type="hidden" name="id" value={d?.id ?? ""} />
              <label><span className="label">{d ? "Code" : "New code"}</span><input name="code" defaultValue={d?.code} className="input uppercase" required placeholder="WELCOME10" /></label>
              <label><span className="label">Type</span>
                <select name="type" defaultValue={d?.type ?? "PERCENT"} className="input"><option value="PERCENT">% off</option><option value="FIXED">$ off</option></select>
              </label>
              <label><span className="label">Value</span><input name="value" defaultValue={d ? (d.type === "PERCENT" ? d.value : centsToDollars(d.value)) : ""} className="input" required /></label>
              <label><span className="label">Min subtotal ($)</span><input name="minSubtotal" defaultValue={centsToDollars(d?.minSubtotalCents)} className="input" /></label>
              <label><span className="label">Max uses</span><input name="maxRedemptions" defaultValue={d?.maxRedemptions ?? ""} className="input" type="number" /></label>
              <label><span className="label">Expires</span><input name="expiresAt" type="date" defaultValue={d?.expiresAt ? d.expiresAt.toISOString().slice(0, 10) : ""} className="input" /></label>
              <label className="flex items-center gap-1 pb-2"><input type="checkbox" name="active" defaultChecked={d?.active ?? true} /> Active</label>
              <button className="btn-primary btn-sm">{d ? "Save" : "Add"}</button>
              {d && <p className="text-xs text-charcoal/60 md:col-span-8">Used {d.redemptions} time(s){d.expiresAt ? ` · expires ${formatDate(d.expiresAt)}` : ""}</p>}
            </form>
          ))}
        </div>
        {discounts.map((d) => (
          <form key={d.id} action={deleteDiscount} className="mt-1 inline-block pr-3">
            <input type="hidden" name="id" value={d.id} />
            <button className="text-xs text-red-700 underline">Remove {d.code}</button>
          </form>
        ))}
      </section>
    </div>
  );
}
