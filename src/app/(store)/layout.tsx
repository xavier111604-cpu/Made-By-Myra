import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getAnnouncement } from "@/lib/content";
import { findCart, summarizeCart } from "@/lib/cart";
import { getSession } from "@/lib/auth";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [announcement, cart, session] = await Promise.all([getAnnouncement(), findCart().then(summarizeCart), getSession()]);
  const user = session?.user ? { name: session.user.name ?? null, role: session.user.role } : null;

  return (
    <>
      {announcement.enabled && announcement.text && (
        <div className="bg-blush px-4 py-2 text-center text-xs font-medium tracking-wide text-charcoal">
          {announcement.link ? (
            <Link href={announcement.link} className="hover:underline">
              {announcement.text}
            </Link>
          ) : (
            announcement.text
          )}
        </div>
      )}
      <SiteHeader cart={cart} user={user} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
