"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <p className="font-script text-5xl">Something went wrong</p>
        <p className="mt-3 text-charcoal/70">Sorry about that — please try again. If it keeps happening, contact us.</p>
        <button onClick={reset} className="btn-primary mt-6">Try again</button>
      </div>
    </main>
  );
}
