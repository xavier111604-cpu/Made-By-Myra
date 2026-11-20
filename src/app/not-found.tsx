import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-screen place-items-center bg-cream px-4 text-center">
      <div>
        <p className="font-script text-6xl">Oh no ♡</p>
        <p className="mt-4 text-charcoal/70">We couldn&apos;t find that page.</p>
        <Link href="/" className="btn-primary mt-8">Back to the shop</Link>
      </div>
    </main>
  );
}
