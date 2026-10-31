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
 * Kartë rezultati në listim (design system i platformës, jo brand-i i restorantit).
 * Karta → profil; slot → rezervim i atij restoranti me të njëjtat parametra.
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
    <div className="flex flex-col overflow-hidden rounded-card-sm sm:rounded-card border border-line bg-surface shadow-card transition hover:border-primary/40">
      <Link href={`/restaurants/${r.slug}`} className="flex items-start gap-4 p-5">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-field bg-primary-soft font-display text-lg text-primary"
          aria-hidden={r.logoUrl ? undefined : true}
        >
          {r.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(r.name)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg text-ink">{r.name}</span>
          {meta && <span className="mt-0.5 block truncate text-sm text-muted">{meta}</span>}
          {r.address && <span className="mt-0.5 block truncate text-xs text-muted">{r.address}</span>}
        </span>
      </Link>

      {availabilityRequested && r.bookingActive && (
        <div className="border-t border-line px-5 py-4">
          {r.slots.length > 0 ? (
            <>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted">Orët e lira</div>
              <div className="flex flex-wrap gap-2">
                {r.slots.map((s) => (
                  <Link
                    key={s.start}
                    href={reserveHref(r.slug, s.time, filters)}
                    className="inline-flex min-h-9 items-center rounded-full border border-primary/30 bg-primary-soft px-3 text-sm font-medium text-primary transition hover:bg-primary hover:text-white"
                  >
                    {s.time}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Pa orë të lira për këtë datë.</span>
              <Link href={`/restaurants/${r.slug}/reserve`} className="text-sm font-medium text-primary hover:underline">
                Provo datë tjetër
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
