export default function Loading() {
  return (
    <div className="container-page grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-charcoal/60">
        <span className="h-3 w-3 animate-ping rounded-full bg-blush-dusty" />
        <span className="font-script text-2xl">Just a moment…</span>
      </div>
    </div>
  );
}
