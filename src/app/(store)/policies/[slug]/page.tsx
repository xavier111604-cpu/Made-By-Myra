import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { POLICY_SLUGS, getPolicy, type PolicySlug } from "@/lib/content";
import { ScriptHeading } from "@/components/decor";
import { RichText } from "@/components/rich-text";
import { formatDate } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

const isPolicy = (s: string): s is PolicySlug => (POLICY_SLUGS as readonly string[]).includes(s);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isPolicy(slug)) return {};
  const p = await getPolicy(slug);
  return { title: p.title, robots: p.approved ? undefined : { index: false } };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  if (!isPolicy(slug)) notFound();
  const policy = await getPolicy(slug);
  return (
    <div className="container-page max-w-3xl py-12">
      <ScriptHeading as="h1" brush className="text-6xl">{policy.title}</ScriptHeading>
      {!policy.approved && (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="note">
          Draft — this policy has not yet been reviewed and approved by Made by Myra.
        </p>
      )}
      {policy.approved && policy.updatedAt && <p className="mt-4 text-xs text-charcoal/60">Last updated {formatDate(policy.updatedAt)}</p>}
      <RichText text={policy.body} className="mt-8 text-charcoal/85" />
    </div>
  );
}
