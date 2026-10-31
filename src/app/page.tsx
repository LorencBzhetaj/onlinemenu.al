import Link from "next/link";
import { Button } from "@/components/ui/button";
import { searchRestaurants, parseSearchParams } from "@/modules/restaurants/search";
import { HomeSearch } from "@/components/discovery/home-search";
import { RestaurantResultCard } from "@/components/discovery/restaurant-result-card";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Të dhëna reale: restorantet e para të publikuara + facets për kërkimin e kryefaqes.
  const result = await searchRestaurants(parseSearchParams({}));
  const featured = result.items.slice(0, 6);

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-xl tracking-wide">
          Menu<span className="text-primary">Digjitale</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/restaurants" className="rounded-full px-3 py-2 text-muted transition hover:text-ink">
            Zbulo
          </Link>
          <Link href="/login" className="rounded-full px-3 py-2 text-muted transition hover:text-ink">
            Hyr
          </Link>
          <Button href="/register" size="sm">
            Për restorantet
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-24">
        <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          Zbulo · Shiko menunë · Rezervo
        </span>
        <h1 className="mt-6 font-display text-4xl leading-tight sm:text-6xl">
          Gjej restorantin dhe <span className="text-primary">rezervo</span> tavolinën
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Kërko restorante sipas qytetit, kuzhinës ose emrit. Shih menunë dygjuhëshe dhe zgjidh një orë të lirë.
        </p>
        <HomeSearch facets={result.facets} />
        <div className="mt-4">
          <Link href="/restaurants" className="text-sm font-medium text-primary hover:underline">
            Shih të gjitha restorantet →
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-ink">Restorante</h2>
            <Link href="/restaurants" className="text-sm text-muted transition hover:text-ink">
              Të gjitha →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((r) => (
              <RestaurantResultCard key={r.slug} r={r} filters={result.filters} availabilityRequested={false} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
          <h2 className="font-display text-2xl text-ink">Je restorant?</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            Menu digjitale me QR të pandryshueshëm, identitet vizual dhe rezervime tavolinash — gati për t&apos;u skanuar në tryezë.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button href="/register">Fillo provën falas</Button>
            <Button href="/login" variant="secondary">Kam llogari</Button>
          </div>
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
