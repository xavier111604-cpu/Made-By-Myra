"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { POLICY_SLUGS, setContent, type AboutContent, type HomeContent } from "@/lib/content";
import { dollarsToCents } from "@/lib/utils";

const str = (fd: FormData, k: string, max = 2000) => z.string().max(max).parse(String(fd.get(k) ?? "")).trim();
const on = (fd: FormData, k: string) => fd.get(k) === "on";
const money = (fd: FormData, k: string) => dollarsToCents(String(fd.get(k) ?? "0"));

function refreshStore() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/content");
}

export async function savePricingSettings(fd: FormData) {
  await requireAdmin();
  await setContent("pricing", {
    designFeeCents: money(fd, "designFee"),
    includedRevisions: z.coerce.number().int().min(0).max(20).parse(fd.get("includedRevisions")),
    extraRevisionFeeCents: money(fd, "extraRevisionFee"),
  });
  revalidatePath("/admin/pricing");
  revalidatePath("/", "layout");
}

export async function saveShippingRate(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id", 40);
  const intOrNull = (k: string) => (String(fd.get(k) ?? "").trim() ? z.coerce.number().int().min(0).max(365).parse(fd.get(k)) : null);
  const data = {
    name: z.string().trim().min(1).max(80).parse(fd.get("name")),
    amountCents: money(fd, "amount"),
    freeOverCents: String(fd.get("freeOver") ?? "").trim() ? money(fd, "freeOver") : null,
    minDays: intOrNull("minDays"),
    maxDays: intOrNull("maxDays"),
    active: on(fd, "active"),
    sortOrder: z.coerce.number().int().min(0).max(99).parse(fd.get("sortOrder") || 0),
  };
  if (id) await db.shippingRate.update({ where: { id }, data });
  else await db.shippingRate.create({ data });
  revalidatePath("/admin/pricing");
}

export async function deleteShippingRate(fd: FormData) {
  await requireAdmin();
  await db.shippingRate.delete({ where: { id: str(fd, "id", 40) } });
  revalidatePath("/admin/pricing");
}

export async function saveDiscount(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id", 40);
  const type = z.enum(["PERCENT", "FIXED"]).parse(fd.get("type"));
  const rawValue = String(fd.get("value") ?? "0");
  const data = {
    code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only").parse(fd.get("code")).toUpperCase(),
    type,
    value: type === "PERCENT" ? z.coerce.number().int().min(1).max(100).parse(rawValue) : dollarsToCents(rawValue),
    minSubtotalCents: String(fd.get("minSubtotal") ?? "").trim() ? money(fd, "minSubtotal") : null,
    maxRedemptions: String(fd.get("maxRedemptions") ?? "").trim() ? z.coerce.number().int().min(1).parse(fd.get("maxRedemptions")) : null,
    expiresAt: String(fd.get("expiresAt") ?? "").trim() ? new Date(String(fd.get("expiresAt")) + "T23:59:59") : null,
    active: on(fd, "active"),
  };
  if (id) await db.discountCode.update({ where: { id }, data });
  else await db.discountCode.create({ data });
  revalidatePath("/admin/pricing");
}

export async function deleteDiscount(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id", 40);
  const used = await db.order.count({ where: { discountCodeId: id } });
  if (used) await db.discountCode.update({ where: { id }, data: { active: false } });
  else await db.discountCode.delete({ where: { id } });
  revalidatePath("/admin/pricing");
}

export async function saveAnnouncement(fd: FormData) {
  await requireAdmin();
  await setContent("announcement", { enabled: on(fd, "enabled"), text: str(fd, "text", 200), link: str(fd, "link", 300) || undefined });
  refreshStore();
}

export async function saveHome(fd: FormData) {
  await requireAdmin();
  const value: HomeContent = {
    heroHeading: str(fd, "heroHeading", 120) || "Made Just for You ♡",
    heroText: str(fd, "heroText", 400),
    heroImageUrl: str(fd, "heroImageUrl", 500) || null,
    heroImageAlt: str(fd, "heroImageAlt", 200),
    promo: { enabled: on(fd, "promoEnabled"), text: str(fd, "promoText", 200), link: str(fd, "promoLink", 300) || "/shop" },
    featuredHeading: str(fd, "featuredHeading", 80) || "Featured Creations",
  };
  await setContent("home", value);
  refreshStore();
}

export async function saveAbout(fd: FormData) {
  await requireAdmin();
  const urls = fd.getAll("photoUrl").map(String);
  const alts = fd.getAll("photoAlt").map(String);
  const photos = urls
    .map((url, i) => ({ url: url.slice(0, 500), alt: (alts[i] ?? "").slice(0, 200) }))
    .filter((p) => /^https:\/\//.test(p.url))
    .slice(0, 4);
  const value: AboutContent = {
    heading: str(fd, "heading", 120) || "Hello, and welcome ♡",
    story: str(fd, "story", 8000),
    photos,
  };
  await setContent("about", value);
  refreshStore();
}

export async function saveSocial(fd: FormData) {
  await requireAdmin();
  const url = (k: string) => {
    const v = str(fd, k, 300);
    return v && /^https:\/\//.test(v) ? v : "";
  };
  await setContent("social", { instagram: url("instagram"), tiktok: url("tiktok"), pinterest: url("pinterest") });
  refreshStore();
}

export async function savePolicy(fd: FormData) {
  await requireAdmin();
  const slug = z.enum(POLICY_SLUGS).parse(fd.get("slug"));
  await setContent(`policy.${slug}`, { title: str(fd, "title", 120), body: str(fd, "body", 30000), approved: on(fd, "approved"), updatedAt: new Date().toISOString() });
  revalidatePath(`/policies/${slug}`);
  revalidatePath("/admin/content");
}

export async function saveFaq(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id", 40);
  const data = {
    question: z.string().trim().min(3).max(300).parse(fd.get("question")),
    answer: z.string().trim().min(1).max(4000).parse(fd.get("answer")),
    sortOrder: z.coerce.number().int().min(0).max(999).parse(fd.get("sortOrder") || 0),
    published: on(fd, "published"),
  };
  if (id) await db.faqItem.update({ where: { id }, data });
  else await db.faqItem.create({ data });
  revalidatePath("/faq");
  revalidatePath("/admin/content");
}

export async function deleteFaq(fd: FormData) {
  await requireAdmin();
  await db.faqItem.delete({ where: { id: str(fd, "id", 40) } });
  revalidatePath("/faq");
  revalidatePath("/admin/content");
}

export async function moderateReview(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id", 40);
  const action = z.enum(["approve", "hide", "delete"]).parse(fd.get("action"));
  if (action === "delete") await db.review.delete({ where: { id } });
  else await db.review.update({ where: { id }, data: { approved: action === "approve" } });
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}
