import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AddressManager } from "@/components/address-manager";

export default async function AddressesPage() {
  const user = await requireUser();
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return (
    <div>
      <h2 className="mb-2 text-xl font-semibold">Saved addresses</h2>
      <p className="mb-6 text-sm text-charcoal/60">Your default address is pre-filled at checkout.</p>
      <AddressManager addresses={addresses.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))} />
    </div>
  );
}
