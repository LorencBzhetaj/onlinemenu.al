import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-midnight text-alpine-cream">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="font-heading text-xl tracking-wide">
          Menu<span className="text-alpine-gold">Digjitale</span>
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="hover:text-alpine-gold transition">
            Hyr
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-alpine-gold px-4 py-2 text-midnight font-medium hover:opacity-90 transition"
          >
            Fillo Provën Falas
          </Link>
        </nav>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-heading text-4xl sm:text-6xl leading-tight">
          Menu digjitale që ruan{" "}
          <span className="text-alpine-gold">identitetin</span> e restorantit tënd
        </h1>
        <p className="mt-6 text-lg text-alpine-cream/80">
          Jo një kallëp gjenerik. Paletë, fonte dhe layout të personalizueshëm,
          QR i pandryshueshëm, dhe menu dygjuhëshe — gati për t&apos;u skanuar.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full bg-alpine-gold px-6 py-3 text-midnight font-medium hover:opacity-90 transition"
          >
            Provo 30 ditë falas
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-alpine-cream/30 px-6 py-3 hover:border-alpine-gold transition"
          >
            Kam llogari
          </Link>
        </div>
        <p className="mt-16 text-sm text-alpine-cream/50">
          Faza 1 (MVP) — themelet e projektit janë gati.
        </p>
      </section>
    </main>
  );
}
