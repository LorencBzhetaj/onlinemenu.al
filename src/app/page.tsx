import Link from "next/link";
import { searchRestaurants, parseSearchParams } from "@/modules/restaurants/search";
import { HomeSearch } from "@/components/discovery/home-search";
import { RestaurantResultCard } from "@/components/discovery/restaurant-result-card";
import { CuisineCards } from "@/components/discovery/cuisine-cards";
import { OmSiteHeader } from "@/components/public/om-site-header";
import { ChefMascot } from "@/components/public/chef-mascot";
import "@/components/public/om-public.css";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Të dhëna reale: restorantet e para të publikuara + facets për kërkimin e kryefaqes.
  const result = await searchRestaurants(parseSearchParams({}));
  const featured = result.items.slice(0, 6);

  return (
    <div className="min-h-screen bg-om-white font-om-body text-om-aubergine">
      <OmSiteHeader active="discover" />

      <main>
        <section className="mx-auto grid max-w-[1120px] items-center gap-8 px-4 pb-10 pt-8 sm:pt-14 md:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <p className="inline-flex items-center rounded-full bg-om-butter px-3 py-1 text-sm font-extrabold">
              Zbulo · Shiko menunë · Rezervo
            </p>
            <h1 className="mt-5 font-om-display text-[2.4rem] font-bold leading-[1.05] sm:text-6xl">
              Restorantet e preferuara, online
            </h1>
            <p className="mt-4 max-w-xl text-lg text-om-ink-soft">
              Shfleto menunë dygjuhëshe, zgjidh një orë të lirë dhe rezervo tavolinën.
            </p>
            <div className="mt-7 max-w-2xl">
              <HomeSearch facets={result.facets} />
            </div>
          </div>
          <div className="hidden justify-center md:flex" aria-hidden="true">
            <div className="grid h-60 w-60 place-items-center rounded-[2.5rem] bg-om-pink-soft">
              <ChefMascot variant="box" size={176} decorative />
            </div>
          </div>
        </section>

        {result.facets.cuisines.length > 0 && (
          <section className="mx-auto max-w-[1120px] px-4 pb-8" aria-labelledby="h-kuzhina">
            <h2 id="h-kuzhina" className="mb-3 font-om-display text-2xl font-semibold">
              Kuzhina
            </h2>
            <CuisineCards cuisines={result.facets.cuisines} />
          </section>
        )}

        {featured.length > 0 && (
          <section className="mx-auto max-w-[1120px] px-4 pb-14" aria-labelledby="h-zbulim">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="h-zbulim" className="font-om-display text-2xl font-semibold">
                Në zbulim
              </h2>
              <Link href="/restaurants" className="inline-flex min-h-11 items-center text-sm font-extrabold underline-offset-4 hover:underline">
                Shiko të gjitha →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((r) => (
                <RestaurantResultCard key={r.slug} r={r} filters={result.filters} availabilityRequested={false} />
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-[1120px] px-4 pb-16">
          <div className="flex flex-col gap-6 rounded-[2rem] bg-om-aubergine p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="max-w-xl">
              <h2 className="font-om-display text-3xl font-semibold">Je restorant?</h2>
              <p className="mt-2 text-white/85">
                Menu digjitale me QR të pandryshueshëm, profil i restorantit dhe rezervime tavolinash — gati për t&apos;u skanuar në tryezë.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex min-h-12 items-center rounded-2xl bg-om-butter px-6 font-extrabold text-om-aubergine">
                Fillo provën falas
              </Link>
              <Link href="/login" className="inline-flex min-h-12 items-center rounded-2xl border-2 border-white/70 px-6 font-extrabold text-white">
                Kam llogari
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-om-line">
        <div className="mx-auto max-w-[1120px] px-4 py-6 text-sm text-om-ink-soft">© {new Date().getFullYear()} OnlineMenu.al</div>
      </footer>
    </div>
  );
}
