import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FEATURES = [
  { title: "QR i pandryshueshëm", body: "Një kod që hap profilin e restorantit — menu, informacion dhe rezervim." },
  { title: "Identiteti yt", body: "Paletë, fonte dhe logo të personalizueshme. Jo një kallëp gjenerik." },
  { title: "Dygjuhëshe AL/EN", body: "Menu, çmime në lek dhe përmbajtje në dy gjuhë, gati për t'u skanuar." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-xl tracking-wide">
          Menu<span className="text-primary">Digjitale</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="rounded-full px-3 py-2 text-muted transition hover:text-ink">
            Hyr
          </Link>
          <Button href="/register" size="sm">
            Fillo Provën Falas
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
        <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          30 ditë falas · pa kartë krediti
        </span>
        <h1 className="mt-6 font-display text-4xl leading-tight sm:text-6xl">
          Menu digjitale që ruan <span className="text-primary">identitetin</span> e restorantit tënd
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Paletë, fonte dhe layout të personalizueshëm, QR i pandryshueshëm dhe menu dygjuhëshe —
          gati për t&apos;u skanuar në tryezë.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button href="/register">Provo 30 ditë falas</Button>
          <Button href="/login" variant="secondary">
            Kam llogari
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-6">
              <h2 className="font-display text-lg text-ink">{f.title}</h2>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted">
          © {new Date().getFullYear()} MenuDigjitale
        </div>
      </footer>
    </main>
  );
}
