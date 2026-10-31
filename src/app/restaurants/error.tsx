"use client";

// Error boundary e segmentit /restaurants — gjendja e gabimit me rikuperim.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <h1 className="font-display text-2xl text-ink">Diçka shkoi gabim</h1>
        <p className="mt-2 text-muted">Nuk u ngarkua kërkimi i restoranteve. Provoni përsëri.</p>
        <button
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary-dark"
        >
          Provo përsëri
        </button>
      </section>
    </main>
  );
}
