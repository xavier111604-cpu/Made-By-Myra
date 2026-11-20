import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { storageConfigured } from "@/lib/storage";
import { stripeConfigured } from "@/lib/stripe";
import { emailConfigured } from "@/lib/email";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Owner dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/requests", label: "Requests & messages" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories & collections" },
  { href: "/admin/pricing", label: "Pricing, shipping & discounts" },
  { href: "/admin/content", label: "Homepage & content" },
  { href: "/admin/reviews", label: "Reviews" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login?callbackUrl=/admin");

  const missing = [!stripeConfigured && "Stripe payments", !storageConfigured && "file storage", !emailConfigured && "email"].filter(Boolean);

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex">
        <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white p-5 md:flex">
          <Link href="/admin" className="heading-script text-3xl">Made by Myra</Link>
          <p className="mb-6 text-xs uppercase tracking-widest text-gold">Owner dashboard</p>
          <nav className="flex flex-col gap-1 text-sm" aria-label="Admin">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2 hover:bg-cream">{n.label}</Link>
            ))}
          </nav>
          <div className="mt-auto space-y-1 border-t border-line pt-4 text-sm">
            <Link href="/" className="block rounded-xl px-3 py-2 hover:bg-cream">View store ↗</Link>
            <SignOutButton className="w-full rounded-xl px-3 py-2 text-left text-charcoal/60 hover:bg-cream" />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="no-print flex gap-2 overflow-x-auto border-b border-line bg-white p-3 text-sm md:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full border border-line px-3 py-1">{n.label}</Link>
            ))}
          </div>
          {missing.length > 0 && (
            <div className="no-print border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
              Not connected yet: {missing.join(", ")}. See the README’s setup section — these features won’t work until configured.
            </div>
          )}
          <main className="p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
