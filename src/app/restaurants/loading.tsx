// Gjendja loading e segmentit /restaurants (skeleton i njësuar me design system-in).
export default function Loading() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-6 py-5">
        <div className="h-7 w-40 animate-pulse rounded-full bg-line" />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-2">
        <div className="h-9 w-64 animate-pulse rounded-full bg-line" />
        <div className="mt-6 h-40 animate-pulse rounded-card border border-line bg-surface" />
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-card border border-line bg-surface" />
          ))}
        </div>
      </section>
    </main>
  );
}
