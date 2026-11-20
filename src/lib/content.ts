import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

// ── Types & defaults for owner-editable content ────────────────────────────────

export type Announcement = { enabled: boolean; text: string; link?: string };
export type HomeContent = {
  heroHeading: string;
  heroText: string;
  heroImageUrl: string | null;
  heroImageAlt: string;
  promo: { enabled: boolean; text: string; link: string };
  featuredHeading: string;
};
export type AboutContent = { heading: string; story: string; photos: { url: string; alt: string }[] };
export type SocialLinks = { instagram: string; tiktok: string; pinterest: string };
export type PricingSettings = {
  designFeeCents: number;
  includedRevisions: number;
  extraRevisionFeeCents: number;
};
export type Policy = { title: string; body: string; approved: boolean; updatedAt?: string };

export const POLICY_SLUGS = ["shipping", "returns", "custom-orders", "privacy", "terms"] as const;
export type PolicySlug = (typeof POLICY_SLUGS)[number];

export const DEFAULTS = {
  announcement: { enabled: true, text: "Made with love, just for you ♡" } as Announcement,
  home: {
    heroHeading: "Made Just for You ♡",
    heroText: "Custom apparel, thoughtful gifts, and personalized creations made with love.",
    heroImageUrl: null,
    heroImageAlt: "Custom printed apparel and personalized gifts",
    promo: { enabled: false, text: "", link: "/shop" },
    featuredHeading: "Featured Creations",
  } as HomeContent,
  about: {
    heading: "Hello, and welcome ♡",
    story:
      "Made by Myra is a small creative business specializing in custom apparel and thoughtful personalized products.\n\nEvery order is reviewed and made with care — whether you bring your own artwork or an idea you'd like help bringing to life.\n\n(Owner: replace this text with your own story from the dashboard.)",
    photos: [],
  } as AboutContent,
  social: { instagram: "", tiktok: "", pinterest: "" } as SocialLinks,
  pricing: { designFeeCents: 1500, includedRevisions: 2, extraRevisionFeeCents: 500 } as PricingSettings,
};

const DRAFT_NOTE =
  "DRAFT — This policy text is a placeholder and has not been reviewed or approved by Made by Myra. It is not a binding policy.";

export const DEFAULT_POLICIES: Record<PolicySlug, Policy> = {
  shipping: {
    title: "Shipping Policy",
    approved: false,
    body: `${DRAFT_NOTE}\n\n## Processing time\nCustom items are made to order. Production times are shown on each product page.\n\n## Shipping methods & rates\nAvailable shipping options and prices are shown at checkout.\n\n## Tracking\nWhen your order ships you'll receive an email with tracking information, which you can also find in your account.`,
  },
  returns: {
    title: "Returns & Refunds",
    approved: false,
    body: `${DRAFT_NOTE}\n\n## Personalized items\n[Owner to decide: describe whether personalized items can be returned or exchanged.]\n\n## Damaged or incorrect items\n[Owner to decide: describe how customers should report a problem and what remedy is offered.]\n\n## How to contact us\nUse the contact page and choose "An existing order".`,
  },
  "custom-orders": {
    title: "Custom Order Policy",
    approved: false,
    body: `${DRAFT_NOTE}\n\n## Your artwork\nYou confirm you have the right to use any artwork, logos, or text you upload.\n\n## Previews\nOn-screen previews are approximations, not guaranteed print proofs. Colors and placement may vary slightly.\n\n## Design requests & proofs\n[Owner to decide: number of included revisions, extra revision fees, and approval deadlines.]`,
  },
  privacy: {
    title: "Privacy Policy",
    approved: false,
    body: `${DRAFT_NOTE}\n\n## What we collect\nInformation you provide when you order, create an account, upload files, or contact us.\n\n## Payments\nPayments are processed by Stripe. Card details are never stored on our servers.\n\n## Your choices\n[Owner to complete with legal review: data retention, rights requests, cookies, and contact details.]`,
  },
  terms: {
    title: "Terms of Service",
    approved: false,
    body: `${DRAFT_NOTE}\n\n[Owner to complete with legal review.]`,
  },
};

// ── Accessors ──────────────────────────────────────────────────────────────────

export const getContent = cache(async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const row = await db.siteContent.findUnique({ where: { key } });
    if (!row) return fallback;
    if (typeof fallback === "object" && fallback !== null && !Array.isArray(fallback)) {
      return { ...fallback, ...(row.value as object) } as T;
    }
    return row.value as T;
  } catch {
    return fallback;
  }
});

export async function setContent(key: string, value: unknown) {
  await db.siteContent.upsert({
    where: { key },
    update: { value: value as Prisma.InputJsonValue },
    create: { key, value: value as Prisma.InputJsonValue },
  });
}

export const getAnnouncement = () => getContent("announcement", DEFAULTS.announcement);
export const getHome = () => getContent("home", DEFAULTS.home);
export const getAbout = () => getContent("about", DEFAULTS.about);
export const getSocial = () => getContent("social", DEFAULTS.social);
export const getPricingSettings = () => getContent("pricing", DEFAULTS.pricing);
export const getPolicy = (slug: PolicySlug) => getContent(`policy.${slug}`, DEFAULT_POLICIES[slug]);
