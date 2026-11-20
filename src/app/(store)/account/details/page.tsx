import { requireUser } from "@/lib/auth";
import { AccountDetailsForm } from "@/components/account-details-form";

export default async function DetailsPage() {
  const user = await requireUser();
  return (
    <div className="max-w-lg">
      <h2 className="mb-6 text-xl font-semibold">Account details</h2>
      <AccountDetailsForm name={user.name ?? ""} email={user.email} hasPassword={Boolean(user.passwordHash)} />
    </div>
  );
}
