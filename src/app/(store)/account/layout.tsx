import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ScriptHeading } from "@/components/decor";
import { SignOutButton } from "@/components/sign-out-button";

const LINKS = [
  { href: "/account", label: "Orders & tracking" },
  { href: "/account?filter=proofs", label: "Design approvals" },
  { href: "/account/addresses", label: "Saved addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/details", label: "Account details" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/account");
  return (
    <div className="container-page py-10">
      <ScriptHeading as="h1" brush className="text-5xl">Hi{user.name ? `, ${user.name.split(" ")[0]}` : ""} ♡</ScriptHeading>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Account" className="flex gap-2 overflow-x-auto text-sm lg:flex-col">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-xl px-3 py-2 hover:bg-cream">{l.label}</Link>
          ))}
          {user.role === "ADMIN" && <Link href="/admin" className="whitespace-nowrap rounded-xl px-3 py-2 font-semibold text-gold hover:bg-cream">Owner dashboard</Link>}
          <SignOutButton />
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
