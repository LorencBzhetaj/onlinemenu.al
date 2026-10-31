import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { getAvailableTimes } from "@/modules/booking/availability";

/**
 * Zbulimi/kërkimi i restoranteve (Faza 6) — shërbim i vetëm, autoritativ në server.
 *
 * Rregulla:
 *  - Listohen VETËM restorantet e publikuara dhe JO të pezulluara (njëjtë si dukshmëria
 *    e profilit). Asnjë të dhënë private nuk ekspozohet (as owner, as email).
 *  - Disponueshmëria merret VETËM nga motori ekzistues i booking-ut (getAvailableTimes),
 *    pa logjikë paralele dhe pa slot të sajuar. Llogaritet vetëm për faqen aktuale të
 *    rezultateve (subset i kufizuar) dhe vetëm për restorantet me BOOKING aktiv.
 *  - Filtrat dhe pagination validohen këtu; faqja/URL-ja vetëm i pasqyron.
 */

export const PAGE_SIZE = 12;
export const MAX_GUESTS = 20;
/** Sa slot-e shfaqen në kartë — i kufizuar që të mos bëhen query të pakufizuara për restorant. */
export const SLOTS_PER_CARD = 5;
const MAX_TEXT = 80;

export type SearchFilters = {
  city: string | null;
  q: string | null;
  cuisine: string | null;
  date: string | null; // YYYY-MM-DD (datë kalendarike e vlefshme)
  time: string | null; // HH:MM 24h
  guests: number | null; // 1..MAX_GUESTS
  page: number; // >= 1
};

export type SlotChip = { time: string; start: string };

export type RestaurantCard = {
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  cuisine: string | null;
  address: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  bookingActive: boolean;
  /** Vetëm kur ka date+guests DHE BOOKING aktiv; përndryshe []. */
  slots: SlotChip[];
};

export type SearchFacets = { cities: string[]; cuisines: string[] };

export type SearchResult = {
  items: RestaurantCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: SearchFilters;
  facets: SearchFacets;
  /** A u kërkua disponueshmëri (date+guests të dhëna dhe të vlefshme). */
  availabilityRequested: boolean;
};

function firstOf(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function cleanText(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim().slice(0, MAX_TEXT);
  return t.length > 0 ? t : null;
}

/** Datë kalendarike reale (jo vetëm format): mbron nga 2026-02-31 etj. */
export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidTimeStr(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Validimi i vetëm i parametrave të kërkimit (server). Vlerat e pavlefshme bihen në heshtje. */
export function parseSearchParams(raw: Record<string, string | string[] | undefined>): SearchFilters {
  const city = cleanText(firstOf(raw.city));
  const q = cleanText(firstOf(raw.q));
  const cuisine = cleanText(firstOf(raw.cuisine));

  const dRaw = firstOf(raw.date);
  const date = dRaw && isValidDateStr(dRaw) ? dRaw : null;

  const tRaw = firstOf(raw.time);
  const time = tRaw && isValidTimeStr(tRaw) ? tRaw : null;

  const gRaw = firstOf(raw.guests);
  const gNum = gRaw != null ? Number(gRaw) : NaN;
  const guests = Number.isInteger(gNum) && gNum >= 1 && gNum <= MAX_GUESTS ? gNum : null;

  const pRaw = firstOf(raw.page);
  const pNum = pRaw != null ? Number(pRaw) : NaN;
  const page = Number.isInteger(pNum) && pNum >= 1 ? pNum : 1;

  return { city, q, cuisine, date, time, guests, page };
}

/** Rend kronologjik, por kur jepet orë preferohen slot-et më pranë asaj ore. */
function pickSlots(slots: { time: string; start: string }[], preferTime: string | null): SlotChip[] {
  const chips = slots.map((s) => ({ time: s.time, start: s.start }));
  if (chips.length <= SLOTS_PER_CARD) return chips;
  if (!preferTime) return chips.slice(0, SLOTS_PER_CARD);
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const target = toMin(preferTime);
  const nearest = [...chips]
    .sort((a, b) => Math.abs(toMin(a.time) - target) - Math.abs(toMin(b.time) - target))
    .slice(0, SLOTS_PER_CARD);
  nearest.sort((a, b) => toMin(a.time) - toMin(b.time));
  return nearest;
}

/** Vlerat reale dalluese të qytetit/kuzhinës mes restoranteve publike — për dropdown-et e filtrit. */
export async function getSearchFacets(): Promise<SearchFacets> {
  const rows = await prisma.restaurant.findMany({
    where: { isPublished: true, suspendedAt: null },
    select: { city: true, cuisine: true },
  });
  const cities = new Set<string>();
  const cuisines = new Set<string>();
  for (const r of rows) {
    if (r.city && r.city.trim()) cities.add(r.city.trim());
    if (r.cuisine && r.cuisine.trim()) cuisines.add(r.cuisine.trim());
  }
  const coll = new Intl.Collator("sq");
  return {
    cities: Array.from(cities).sort((a, b) => coll.compare(a, b)),
    cuisines: Array.from(cuisines).sort((a, b) => coll.compare(a, b)),
  };
}

export async function searchRestaurants(filters: SearchFilters, now: Date = new Date()): Promise<SearchResult> {
  const where: Prisma.RestaurantWhereInput = {
    isPublished: true,
    suspendedAt: null,
    ...(filters.city ? { city: { equals: filters.city, mode: "insensitive" } } : {}),
    ...(filters.cuisine ? { cuisine: { equals: filters.cuisine, mode: "insensitive" } } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };

  const total = await prisma.restaurant.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);

  const rows = await prisma.restaurant.findMany({
    where,
    orderBy: [{ name: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      city: true,
      cuisine: true,
      address: true,
      primaryColor: true,
      accentColor: true,
    },
  });

  const availabilityRequested = filters.date != null && filters.guests != null;

  // Entitlement BOOKING vetëm për faqen aktuale (subset i kufizuar ≤ PAGE_SIZE).
  const bookingFlags = await Promise.all(rows.map((r) => hasEntitlement(r.id, "BOOKING")));

  const items: RestaurantCard[] = await Promise.all(
    rows.map(async (r, i) => {
      const bookingActive = bookingFlags[i];
      let slots: SlotChip[] = [];
      if (availabilityRequested && bookingActive) {
        const all = await getAvailableTimes({
          restaurantId: r.id,
          dateStr: filters.date!,
          partySize: filters.guests!,
          requestedArea: "no_preference",
          now,
        });
        slots = pickSlots(all, filters.time);
      }
      return {
        slug: r.slug,
        name: r.name,
        logoUrl: r.logoUrl,
        city: r.city,
        cuisine: r.cuisine,
        address: r.address,
        primaryColor: r.primaryColor,
        accentColor: r.accentColor,
        bookingActive,
        slots,
      };
    })
  );

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
    filters: { ...filters, page },
    facets: await getSearchFacets(),
    availabilityRequested,
  };
}
