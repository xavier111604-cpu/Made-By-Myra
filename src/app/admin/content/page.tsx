import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { POLICY_SLUGS, getAbout, getAnnouncement, getHome, getPolicy, getSocial } from "@/lib/content";
import { deleteFaq, saveAbout, saveAnnouncement, saveFaq, saveHome, savePolicy, saveSocial } from "@/actions/admin-settings";
import { ImageUrlField } from "@/components/admin/image-url-field";

export default async function ContentPage() {
  await requireAdmin();
  const [announcement, home, about, social, faqs, policies, subscribers] = await Promise.all([
    getAnnouncement(),
    getHome(),
    getAbout(),
    getSocial(),
    db.faqItem.findMany({ orderBy: { sortOrder: "asc" } }),
    Promise.all(POLICY_SLUGS.map(async (slug) => ({ slug, ...(await getPolicy(slug)) }))),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="heading-script text-5xl">Homepage & content</h1>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Announcement bar</h2>
        <form action={saveAnnouncement} className="grid gap-3 text-sm md:grid-cols-[2fr_1fr_auto_auto]">
          <input name="text" defaultValue={announcement.text} className="input" maxLength={200} aria-label="Announcement text" />
          <input name="link" defaultValue={announcement.link ?? ""} className="input" placeholder="Optional link, e.g. /shop" aria-label="Announcement link" />
          <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={announcement.enabled} /> Show</label>
          <button className="btn-primary btn-sm">Save</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Homepage</h2>
        <form action={saveHome} className="grid gap-4 text-sm md:grid-cols-2">
          <label><span className="label">Hero heading</span><input name="heroHeading" defaultValue={home.heroHeading} className="input" /></label>
          <label><span className="label">Featured section heading</span><input name="featuredHeading" defaultValue={home.featuredHeading} className="input" /></label>
          <label className="md:col-span-2"><span className="label">Hero text</span><textarea name="heroText" defaultValue={home.heroText} className="input min-h-16" /></label>
          <ImageUrlField name="heroImageUrl" initial={home.heroImageUrl} label="Hero image (lifestyle photo)" />
          <label><span className="label">Hero image description (alt text)</span><input name="heroImageAlt" defaultValue={home.heroImageAlt} className="input" /></label>
          <fieldset className="rounded-xl border border-line p-3 md:col-span-2">
            <legend className="px-1 text-xs font-semibold">Promotional banner</legend>
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
              <input name="promoText" defaultValue={home.promo.text} className="input" placeholder="e.g. Holiday orders: order by Dec 10" aria-label="Promo text" />
              <input name="promoLink" defaultValue={home.promo.link} className="input" aria-label="Promo link" />
              <label className="flex items-center gap-2"><input type="checkbox" name="promoEnabled" defaultChecked={home.promo.enabled} /> Show</label>
            </div>
          </fieldset>
          <div><button className="btn-primary btn-sm">Save homepage</button></div>
        </form>
        <p className="mt-3 text-xs text-charcoal/60">Featured products are chosen on each product (“Featured on homepage”). Seasonal collections are managed under Categories.</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">About page — your story</h2>
        <form action={saveAbout} className="space-y-4 text-sm">
          <label className="block"><span className="label">Heading</span><input name="heading" defaultValue={about.heading} className="input" /></label>
          <label className="block"><span className="label">Your story (use “## ” for a heading, blank lines between paragraphs)</span><textarea name="story" defaultValue={about.story} className="input min-h-48" /></label>
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 rounded-xl border border-line p-3">
                <ImageUrlField name="photoUrl" initial={about.photos[i]?.url} label={`Photo ${i + 1}`} />
                <input name="photoAlt" defaultValue={about.photos[i]?.alt ?? ""} className="input" placeholder="Describe the photo" aria-label={`Photo ${i + 1} description`} />
              </div>
            ))}
          </div>
          <button className="btn-primary btn-sm">Save about page</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Social links</h2>
        <form action={saveSocial} className="grid gap-3 text-sm md:grid-cols-4">
          <input name="instagram" defaultValue={social.instagram} className="input" placeholder="https://instagram.com/…" aria-label="Instagram URL" />
          <input name="tiktok" defaultValue={social.tiktok} className="input" placeholder="https://tiktok.com/@…" aria-label="TikTok URL" />
          <input name="pinterest" defaultValue={social.pinterest} className="input" placeholder="https://pinterest.com/…" aria-label="Pinterest URL" />
          <button className="btn-primary btn-sm">Save</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">FAQ</h2>
        <p className="mb-3 text-xs text-charcoal/60">Starter questions are drafts — please edit the answers to match how you actually work.</p>
        <div className="space-y-3">
          {[...faqs, null].map((f, i) => (
            <form key={f?.id ?? `new-${i}`} action={saveFaq} className="space-y-2 rounded-xl border border-line p-3 text-sm">
              <input type="hidden" name="id" value={f?.id ?? ""} />
              <input name="question" defaultValue={f?.question} className="input font-medium" placeholder="New question" required aria-label="Question" />
              <textarea name="answer" defaultValue={f?.answer} className="input min-h-20" placeholder="Answer" required aria-label="Answer" />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={f?.published ?? true} /> Published</label>
                <label className="flex items-center gap-2">Order <input name="sortOrder" type="number" defaultValue={f?.sortOrder ?? faqs.length} className="input w-20 py-1" /></label>
                <button className="btn-primary btn-sm">{f ? "Save" : "Add question"}</button>
              </div>
            </form>
          ))}
        </div>
        {faqs.map((f) => (
          <form key={f.id} action={deleteFaq} className="mt-1 inline-block pr-3">
            <input type="hidden" name="id" value={f.id} />
            <button className="text-xs text-red-700 underline">Delete “{f.question.slice(0, 30)}…”</button>
          </form>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Policies</h2>
        <p className="mb-3 text-xs text-charcoal/60">Policies show a “Draft” notice until you tick “Reviewed & approved”. Please have them reviewed before relying on them.</p>
        <div className="space-y-4">
          {policies.map((p) => (
            <details key={p.slug} className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm font-medium">{p.title} {p.approved ? "✅" : <span className="text-amber-700">(draft)</span>}</summary>
              <form action={savePolicy} className="mt-3 space-y-2 text-sm">
                <input type="hidden" name="slug" value={p.slug} />
                <input name="title" defaultValue={p.title} className="input" aria-label="Policy title" />
                <textarea name="body" defaultValue={p.body} className="input min-h-64 font-mono text-xs" aria-label="Policy text" />
                <label className="flex items-center gap-2"><input type="checkbox" name="approved" defaultChecked={p.approved} /> Reviewed & approved (removes the draft notice)</label>
                <button className="btn-primary btn-sm">Save policy</button>
              </form>
            </details>
          ))}
        </div>
      </section>

      <section className="card p-5 text-sm">
        <h2 className="mb-1 font-semibold">Newsletter</h2>
        <p>{subscribers} subscriber(s) with recorded consent. {process.env.RESEND_AUDIENCE_ID ? "New sign-ups sync to your Resend Audience." : "Connect a Resend Audience (RESEND_AUDIENCE_ID) to send campaigns."}</p>
      </section>
    </div>
  );
}
