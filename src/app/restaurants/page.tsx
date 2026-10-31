import Link from "next/link";
import type { Metadata } from "next";
import { parseSearchParams, searchRestaurants, type SearchFilters } from "@/modules/restaurants/search";
import { SearchFilters as SearchFiltersBar } from "@/components/discovery/search-filters";
import { RestaurantResultCard } from "@/components/discovery/restaurant-result-card";
import { EmptyState } from "@/components/ui/states";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zbulo restorante",
  description: "Kërko restorante sipas qytetit, kuzhinës dhe emrit — shih menunë dhe rezervo një tavolinë.",
  // Faqja e kërkimit indeksohet në formën e saj të pastër; variantet me filtra ulen te canonical.
  alternates: { canonical: absoluteUrl("/restaurants") },
};

function todayInTirane(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tirane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function pageHref(filters: SearchFilters, page: number): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.city) p.set("city", filters.city);
  if (filters.cuisine) p.set("cuisine", filters.cuisine);
  if (filters.date) p.set("date", filters.date);
  if (filters.time) p.set("time", filters.time);
  if (filters.guests) p.set("guests", String(filters.guests));
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/restaurants?${qs}` : "/restaurants";
}

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseSearchParams(searchParams);
  const result = await searchRestaurants(filters);

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-xl tracking-wide">
          Menu<span className="text-primary">Digjitale</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/register" className="rounded-full px-3 py-2 text-muted transition hover:text-ink">
            Për restorantet
          </Link>
          <Link href="/login" className="rounded-full px-3 py-2 text-muted transition hover:text-ink">
            Hyr
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-2">
        <h1 className="font-display text-3xl sm:text-4xl">Zbulo restorante</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Kërko sipas qytetit, kuzhinës ose emrit. Zgjidh datën dhe personat për të parë orët e lira.
        </p>

        <div className="mt-6">
          <SearchFiltersBar filters={filters} facets={result.facets} todayStr={todayInTirane()} />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted" aria-live="polite">
            {result.total === 0
              ? "Asnjë rezultat"
              : result.total === 1
                ? "1 restorant"
                : `${result.total} restorante`}
          </p>
          {result.totalPages > 1 && (
            <p className="text-sm text-muted">Faqja {result.page} / {result.totalPages}</p>
          )}
        </div>

        <div className="mt-4">
          {result.items.length === 0 ? (
            <EmptyState title="Nuk u gjet asnjë restorant">
              Provo të heqësh disa filtra ose të ndryshosh qytetin/kuzhinën.{" "}
              <Link href="/restaurants" className="text-primary hover:underline">Pastro filtrat</Link>.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.items.map((r) => (
                <RestaurantResultCard
                  key={r.slug}
                  r={r}
                  filters={result.filters}
                  availabilityRequested={result.availabilityRequested}
                />
              ))}
            </div>
          )}
        </div>

        {result.totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Faqet">
            {result.page > 1 && (
              <Link
                href={pageHref(result.filters, result.page - 1)}
                className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-sm text-ink transition hover:border-primary/50"
              >
                ← Para
              </Link>
            )}
            {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={pageHref(result.filters, n)}
                aria-current={n === result.page ? "page" : undefined}
                className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm transition ${
                  n === result.page
                    ? "bg-primary text-white"
                    : "border border-line bg-surface text-ink hover:border-primary/50"
                }`}
              >
                {n}
              </Link>
            ))}
            {result.page < result.totalPages && (
              <Link
                href={pageHref(result.filters, result.page + 1)}
                className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-sm text-ink transition hover:border-primary/50"
              >
                Pas →
              </Link>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
