import Link from "next/link";
import { getSocial } from "@/lib/content";
import { InstagramIcon, PinterestIcon, TikTokIcon } from "./icons";
import { NewsletterForm } from "./newsletter-form";
import { HeartDoodle } from "./decor";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "Shop all" },
      { href: "/customize", label: "Customize your own" },
      { href: "/creations", label: "Our creations" },
      { href: "/account/wishlist", label: "Wishlist" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/policies/shipping", label: "Shipping policy" },
      { href: "/policies/returns", label: "Return policy" },
      { href: "/policies/custom-orders", label: "Custom order policy" },
      { href: "/policies/privacy", label: "Privacy policy" },
      { href: "/policies/terms", label: "Terms of service" },
    ],
  },
];

export async function SiteFooter() {
  const social = await getSocial();
  const socials = [
    { href: social.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: social.tiktok, label: "TikTok", Icon: TikTokIcon },
    { href: social.pinterest, label: "Pinterest", Icon: PinterestIcon },
  ].filter((s) => s.href);

  return (
    <footer className="mt-24 border-t border-line bg-cream">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <p className="heading-script text-4xl">
            Made by Myra <HeartDoodle className="inline text-blush-hover" />
          </p>
          <p className="mt-2 max-w-xs text-sm text-charcoal/70">Custom apparel, gifts & accessories — made with love, just for you.</p>
          <div className="mt-6 max-w-sm">
            <p className="mb-2 text-sm font-semibold">Join our newsletter</p>
            <NewsletterForm compact source="footer" />
          </div>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="mb-3 text-sm font-semibold">{c.title}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="link-gold">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-charcoal/60 sm:flex-row">
          <p>© {new Date().getFullYear()} Made by Myra. All rights reserved.</p>
          {socials.length > 0 && (
            <div className="flex gap-3">
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="rounded-full p-2 hover:bg-blush hover:text-charcoal">
                  <Icon />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
