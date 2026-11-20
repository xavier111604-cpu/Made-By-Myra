import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { CONTACT_CATEGORIES } from "@/lib/labels";
import { closeRequest, replyToQuote, toggleContactHandled } from "@/actions/admin-orders";

export default async function RequestsPage() {
  await requireAdmin();
  const [quotes, messages] = await Promise.all([
    db.designRequest.findMany({ where: { orderItemId: null }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 }),
    db.contactMessage.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  return (
    <div className="space-y-10">
      <h1 className="heading-script text-5xl">Requests & messages</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Design quote requests</h2>
        <p className="mb-3 text-xs text-charcoal/60">Submitted for products set to “Quote first”. Nothing has been charged. Reply with a price and next steps — your reply is emailed to the customer.</p>
        <div className="space-y-4">
          {quotes.map((q) => (
            <div key={q.id} id={q.id} className="card p-5 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{q.name || q.email} <span className="font-normal text-charcoal/60">· {q.email}</span></p>
                <span className="chip">{q.status.replace("_", " ").toLowerCase()} · {formatDateTime(q.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line">{q.description}</p>
              <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                {[["Text", q.textToInclude], ["Colors", q.preferredColors], ["Style", q.style], ["Placement", q.placement], ["Occasion", q.occasion], ["Notes", q.notes]]
                  .filter(([, v]) => v)
                  .map(([k, v]) => <div key={k} className="whitespace-pre-line"><strong>{k}:</strong> {v}</div>)}
              </dl>
              {q.inspirationUploadIds.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {q.inspirationUploadIds.map((id) => (
                    <a key={id} href={`/api/files/${id}?dl=1`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${id}`} alt="Inspiration" className="h-20 w-20 rounded-lg border border-line object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {q.ownerReply && <p className="mt-3 rounded-xl bg-cream p-3 text-xs"><strong>Your reply:</strong> {q.ownerReply}</p>}
              {q.status !== "CLOSED" && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <form action={replyToQuote} className="flex flex-1 flex-col gap-2">
                    <input type="hidden" name="id" value={q.id} />
                    <textarea name="reply" className="input min-h-20" placeholder="Hi! I'd love to make this. The price would be…" required aria-label="Reply" />
                    <button className="btn-primary btn-sm self-start">Email reply</button>
                  </form>
                  <form action={closeRequest}><input type="hidden" name="id" value={q.id} /><button className="btn-ghost btn-sm">Close</button></form>
                </div>
              )}
            </div>
          ))}
          {quotes.length === 0 && <p className="text-sm text-charcoal/60">No quote requests.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Contact form messages</h2>
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} id={`msg-${m.id}`} className={`card p-4 text-sm ${m.handled ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap justify-between gap-2">
                <p><strong>{m.subject}</strong> · {CONTACT_CATEGORIES.find((c) => c.value === m.category)?.label}</p>
                <span className="text-xs text-charcoal/60">{formatDateTime(m.createdAt)}</span>
              </div>
              <p className="text-xs text-charcoal/60">{m.name} · <a href={`mailto:${m.email}`} className="underline">{m.email}</a></p>
              <p className="mt-2 whitespace-pre-line">{m.message}</p>
              <div className="mt-2 flex items-center gap-4">
                {m.uploadId && <a href={`/api/files/${m.uploadId}?dl=1`} className="text-xs underline">Download attachment</a>}
                <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`} className="text-xs underline">Reply by email</a>
                <form action={toggleContactHandled}><input type="hidden" name="id" value={m.id} /><button className="text-xs underline">{m.handled ? "Mark unhandled" : "Mark handled"}</button></form>
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-charcoal/60">No messages.</p>}
        </div>
      </section>
    </div>
  );
}
