import Link from "next/link";
import type { RestaurantCard, SearchFilters } from "@/modules/restaurants/search";

function reserveHref(slug: string, time: string, filters: SearchFilters): string {
  const p = new URLSearchParams();
  if (filters.date) p.set("date", filters.date);
  if (filters.guests) p.set("guests", String(filters.guests));
  if (time) p.set("time", time);
  const qs = p.toString();
  return `/restaurants/${slug}/reserve${qs ? `?${qs}` : ""}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Kartë rezultati në Zbulo (paleta OnlineMenu.al). Vetëm të dhëna reale: pa vlerësime/foto të sajuara.
 * Karta → profil; Rezervo → formulari i rezervimit (vetëm kur BOOKING aktiv); slot → rezervim me parametrat.
 */
export function RestaurantResultCard({
  r,
  filters,
  availabilityRequested,
}: {
  r: RestaurantCard;
  filters: SearchFilters;
  availabilityRequested: boolean;
}) {
  const meta = [r.cuisine, r.city].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-om-line bg-om-surface font-om-body text-om-aubergine transition hover:border-om-pink">
      <Link href={`/restaurants/${r.slug}`} className="group block">
        <div
          className="h-20 bg-om-pink [background-image:radial-gradient(rgba(76,24,69,0.12)_1.6px,transparent_1.8px)] [background-size:18px_18px]"
          aria-hidden="true"
        />
        <div className="-mt-9 flex items-end gap-3 px-5">
          <span
            className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-om-surface bg-om-aubergine font-om-display text-xl font-bold text-om-butter"
            aria-hidden="true"
          >
            {r.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logoUrl} alt="" className="h-full w-full bg-white object-cover" />
            ) : (
              initials(r.name)
            )}
          </span>
        </div>
        <div className="px-5 pb-4 pt-2">
          <h3 className="truncate font-om-display text-xl font-semibold group-hover:underline">{r.name}</h3>
          {meta && <p className="mt-0.5 truncate text-sm font-bold text-om-ink-soft">{meta}</p>}
          {r.address && <p className="mt-0.5 truncate text-sm text-om-ink-soft">{r.address}</p>}
        </div>
      </Link>

      <div className="mt-auto flex flex-wrap gap-2 px-5 pb-5">
        <Link
          href={`/restaurants/${r.slug}/menu`}
          className="inline-flex min-h-11 items-center rounded-xl bg-om-aubergine px-4 text-sm font-extrabold text-white"
        >
          Menuja
        </Link>
        {r.bookingActive && (
          <Link
            href={`/restaurants/${r.slug}/reserve`}
            className="inline-flex min-h-11 items-center rounded-xl bg-om-butter px-4 text-sm font-extrabold text-om-aubergine"
          >
            Rezervo
          </Link>
        )}
      </div>

      {availabilityRequested && r.bookingActive && (
        <div className="border-t border-om-line px-5 py-4">
          {r.slots.length > 0 ? (
            <>
              <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-om-ink-soft">Orët e lira</div>
              <div className="flex flex-wrap gap-2">
                {r.slots.map((s) => (
                  <Link
                    key={s.start}
                    href={reserveHref(r.slug, s.time, filters)}
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-om-line bg-om-white px-4 text-sm font-bold text-om-aubergine transition hover:border-om-aubergine hover:bg-om-butter"
                  >
                    {s.time}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-om-ink-soft">Pa orë të lira për këtë datë.</span>
              <Link href={`/restaurants/${r.slug}/reserve`} className="text-sm font-extrabold underline">
                Provo datë tjetër
              </Link>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
