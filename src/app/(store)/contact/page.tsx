import type { Metadata } from "next";
import { ScriptHeading } from "@/components/decor";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = { title: "Contact", description: "Questions, existing orders or custom design inquiries — we'd love to hear from you." };

export default function ContactPage() {
  return (
    <div className="container-page max-w-2xl py-12">
      <ScriptHeading as="h1" brush className="text-6xl">Say hello ♡</ScriptHeading>
      <p className="mt-4 text-charcoal/70">Questions about an order, a custom idea, or anything else? Send us a message and we&apos;ll get back to you by email.</p>
      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  );
}
