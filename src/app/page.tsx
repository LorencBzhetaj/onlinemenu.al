import Link from "next/link";
import { searchRestaurants, parseSearchParams } from "@/modules/restaurants/search";
import { HomeSearch } from "@/components/discovery/home-search";
import { RestaurantResultCard } from "@/components/discovery/restaurant-result-card";
import { CuisineCards } from "@/components/discovery/cuisine-cards";
import { OmSiteHeader } from "@/components/public/om-site-header";
import { OmSiteFooter } from "@/components/public/om-site-footer";
import { CatalogScrollRestore } from "@/components/discovery/catalog-scroll-restore";
import { ChefMascot } from "@/components/public/chef-mascot";
import "@/components/public/om-public.css";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Të dhëna reale: restorantet e publikuara + facets (qytetet/kuzhinat) për kërkimin e kryefaqes.
  const result = await searchRestaurants(parseSearchParams({}));
  const featured = result.items;

  return (
    <div className="min-h-screen bg-om-white font-om-body text-om-aubergine">
      <OmSiteHeader active="restaurants" />

      <main>
        {/* Hero kompakt: titulli + kërkimi nxënë në krye që kartat të shfaqen pa scroll të gjatë. */}
        <section className="mx-auto grid max-w-[1120px] items-center gap-6 px-4 pb-5 pt-5 sm:pt-8 md:grid-cols-[minmax(0,1fr)_200px]">
          <div className="min-w-0">
            <p className="hidden items-center rounded-full bg-om-butter px-3 py-1 text-sm font-extrabold sm:inline-flex">
              Zbulo · Shiko menunë · Rezervo
            </p>
            <h1 className="font-om-display text-[1.95rem] font-bold leading-[1.05] sm:mt-4 sm:text-5xl">
              Restorantet e preferuara, online
            </h1>
            <p className="mt-2 max-w-xl text-base text-om-ink-soft sm:mt-3 sm:text-lg">
              Shfleto menunë dygjuhëshe, zgjidh një orë të lirë dhe rezervo tavolinën.
            </p>
            <div className="mt-4 max-w-2xl sm:mt-5">
              <HomeSearch facets={result.facets} />
            </div>
          </div>
          <div className="hidden justify-center md:flex" aria-hidden="true">
            <div className="grid h-48 w-48 place-items-center rounded-[2rem] bg-om-pink-soft">
              <ChefMascot variant="box" size={160} decorative />
            </div>
          </div>
        </section>

        {result.facets.cuisines.length > 0 && (
          <section className="mx-auto max-w-[1120px] px-4 pb-4" aria-labelledby="h-kuzhina">
            <h2 id="h-kuzhina" className="mb-2 font-om-display text-xl font-semibold">
              Kuzhina
            </h2>
            <CuisineCards cuisines={result.facets.cuisines} />
          </section>
        )}

        {featured.length > 0 && (
          <section className="mx-auto max-w-[1120px] pb-10" aria-labelledby="h-zbulim">
            <div className="mb-2 flex items-baseline justify-between gap-4 px-4">
              <h2 id="h-zbulim" className="font-om-display text-xl font-semibold">
                Në zbulim
              </h2>
              <Link href="/restaurants" className="inline-flex min-h-11 items-center text-sm font-extrabold underline-offset-4 hover:underline">
                Shiko të gjitha →
              </Link>
            </div>
            {/* Rresht horizontal (si te mockup-i): karta pranë njëra-tjetrës, me scroll-snap. */}
            <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 [scrollbar-width:thin]" aria-label="Restorantet" data-scroll-key="featured">
              {featured.map((r) => (
                <li key={r.slug} className="flex w-[78%] max-w-[320px] shrink-0 snap-start sm:w-[300px]">
                  <RestaurantResultCard r={r} filters={result.filters} availabilityRequested={false} fromPath="/" />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mx-auto max-w-[1120px] px-4 pb-14">
          <div className="flex flex-col gap-4 rounded-[2rem] bg-om-aubergine p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-xl">
              <h2 className="font-om-display text-2xl font-semibold">Je restorant?</h2>
              <p className="mt-1 text-white/85">Menu digjitale, profil publik dhe QR për tavolinat — të përditësuara nga paneli.</p>
            </div>
            <Link href="/per-bizneset" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-om-butter px-6 font-extrabold text-om-aubergine">
              Për bizneset
            </Link>
          </div>
        </section>
      </main>

      <CatalogScrollRestore />
      <OmSiteFooter />
    </div>
  );
}
