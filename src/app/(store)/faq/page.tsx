import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { ScriptHeading } from "@/components/decor";
import { RichText } from "@/components/rich-text";

export const metadata: Metadata = { title: "FAQ", description: "Answers about custom orders, file formats, design help, shipping, sizing and care." };

export default async function FaqPage() {
  const faqs = await db.faqItem.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <div className="container-page max-w-3xl py-12">
      {faqs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <ScriptHeading as="h1" brush className="text-6xl">Questions & Answers</ScriptHeading>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {faqs.map((f) => (
          <details key={f.id} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {f.question}
              <span className="text-xl text-gold transition group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <RichText text={f.answer} className="mt-3 text-charcoal/80" />
          </details>
        ))}
      </div>
      {faqs.length === 0 && <p className="mt-6 text-charcoal/60">FAQs are coming soon.</p>}
      <p className="mt-10 text-center text-sm">
        Still have a question? <Link href="/contact" className="link-gold font-medium">Send us a message</Link>
      </p>
    </div>
  );
}
