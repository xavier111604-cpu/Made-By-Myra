import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAbout } from "@/lib/content";
import { ScriptHeading, HeartDoodle } from "@/components/decor";
import { RichText } from "@/components/rich-text";

export const metadata: Metadata = { title: "About Us", description: "Made by Myra is a small creative business specializing in custom apparel and thoughtful personalized products." };

export default async function AboutPage() {
  const about = await getAbout();
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl text-center">
        <ScriptHeading as="h1" brush className="text-6xl">{about.heading}</ScriptHeading>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl items-start gap-10 md:grid-cols-[1.2fr_1fr]">
        <RichText text={about.story} className="text-lg text-charcoal/80" />
        <div className="grid grid-cols-2 gap-3">
          {about.photos.length ? (
            about.photos.slice(0, 4).map((p, i) => (
              <div key={i} className={`relative overflow-hidden rounded-2xl bg-cream ${i === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square"}`}>
                <Image src={p.url} alt={p.alt || "Made by Myra"} fill sizes="(min-width:768px) 30vw, 90vw" className="object-cover" />
              </div>
            ))
          ) : (
            <div className="col-span-2 grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-line bg-cream text-center text-sm text-charcoal/50">
              <span>
                <HeartDoodle className="mx-auto mb-2 text-blush-hover" />
                Photos added from the dashboard will appear here.
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-16 text-center">
        <Link href="/customize" className="btn-primary">Start something special</Link>
      </div>
    </div>
  );
}
