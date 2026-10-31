/*
 * Teste për Fazën 6 (zbulimi/kërkimi i restoranteve) — kundrejt Postgres LOKAL.
 * Mbulon: validimin e parametrave, gate publikim/pezullim, filtrat qytet/kuzhinë/emër,
 * pagination (clamp), facets, dhe disponueshmërinë reale (date/persona + timezone) vetëm
 * për restorantet me BOOKING aktiv dhe të kufizuar në SLOTS_PER_CARD.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { updateBookingSettings, setOpeningHours, createArea, createTable } from "@/modules/booking/config";
import { purgeRestaurantBookingData } from "@/modules/booking/config";
import { toBusinessDateKey } from "@/modules/booking/timezone";
import {
  parseSearchParams,
  searchRestaurants,
  isValidDateStr,
  getSearchFacets,
  PAGE_SIZE,
  SLOTS_PER_CARD,
  MAX_GUESTS,
} from "@/modules/restaurants/search";

(function guardDb() {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = url.includes("@localhost") || url.includes("@127.0.0.1");
  const looksRemote = /neon\.tech|amazonaws|supabase|\.cloud/i.test(url);
  if (process.env.ALLOW_NONLOCAL_TEST_DB === "1") return;
  if (!url || !isLocal || looksRemote) {
    console.error("⛔ REFUZOHET: testet ekzekutohen vetëm kundrejt një DB LOKALE testimi.");
    process.exit(2);
  }
})();

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

const SUF = "@test.local";
const TZ = "Europe/Tirane";

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: users.map((u) => u.id) } }, select: { id: true } });
  for (const r of rests) await purgeRestaurantBookingData(r.id);
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}

function futureDateKey(offsetDays: number): string {
  return toBusinessDateKey(new Date(Date.now() + offsetDays * 86400000), TZ);
}

/** Krijon restorant; e publikon/pezullon dhe vendos city/cuisine; opsionalisht BOOKING + tavolina. */
async function makeRestaurant(opts: {
  tag: string;
  name: string;
  city?: string | null;
  cuisine?: string | null;
  published?: boolean;
  suspended?: boolean;
  booking?: boolean;
  seats?: number[];
}) {
  const user = await prisma.user.create({
    data: { email: `${opts.tag}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true },
    select: { id: true },
  });
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, user.id, opts.name));
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: opts.name,
      city: opts.city ?? null,
      cuisine: opts.cuisine ?? null,
      isPublished: opts.published ?? true,
      suspendedAt: opts.suspended ? new Date() : null,
    },
  });
  if (opts.booking) {
    const sub = await prisma.subscription.findUnique({ where: { restaurantId }, select: { id: true } });
    await prisma.moduleEntitlement.update({
      where: { subscriptionId_module: { subscriptionId: sub!.id, module: "BOOKING" } },
      data: { status: "active" },
    });
    await updateBookingSettings(restaurantId, {});
    await setOpeningHours(
      restaurantId,
      [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "12:00", endTime: "23:00" }))
    );
    const area = await createArea(restaurantId, { name: "Brenda", kind: "indoor" });
    for (let i = 0; i < (opts.seats ?? [2]).length; i++) {
      await createTable(restaurantId, { name: `T${i + 1}`, seats: (opts.seats ?? [2])[i], areaId: area.id });
    }
  }
  return restaurantId;
}

async function run() {
  await cleanup();
  console.log("\n▶ Faza 6 — zbulimi/kërkimi\n");

  // ── 1) Validimi i parametrave ──────────────────────────────────────────
  ok("isValidDateStr pranon datë reale", isValidDateStr("2026-11-06"));
  ok("isValidDateStr refuzon 2026-02-31", !isValidDateStr("2026-02-31"));
  ok("isValidDateStr refuzon format të keq", !isValidDateStr("6-11-2026"));

  const p1 = parseSearchParams({ date: "2026-13-01", time: "25:00", guests: "0", page: "-2" });
  ok("date e pavlefshme → null", p1.date === null);
  ok("time e pavlefshme → null", p1.time === null);
  ok("guests jashtë kufirit → null", p1.guests === null);
  ok("page i pavlefshëm → 1", p1.page === 1);

  const p2 = parseSearchParams({ q: "  Gjeçaj  ", guests: String(MAX_GUESTS + 5), time: "19:30", date: "2026-11-06", page: "3" });
  ok("q trim-ohet", p2.q === "Gjeçaj");
  ok("guests mbi MAX → null", p2.guests === null);
  ok("time valid ruhet", p2.time === "19:30");
  ok("page valid ruhet", p2.page === 3);

  // ── 2) Gate publikim/pezullim ──────────────────────────────────────────
  const token = `z6disc${Date.now().toString(36)}`;
  await makeRestaurant({ tag: `${token}-pub`, name: `${token} Published`, city: "Tiranë", cuisine: "Tradicionale" });
  await makeRestaurant({ tag: `${token}-unpub`, name: `${token} Unpublished`, published: false });
  await makeRestaurant({ tag: `${token}-susp`, name: `${token} Suspended`, suspended: true });

  const gateRes = await searchRestaurants(parseSearchParams({ q: token }));
  ok("listohet vetëm i publikuari & jo i pezulluar", gateRes.total === 1 && gateRes.items[0].name === `${token} Published`);
  ok("asnjë të dhënë private (pa id/ownerId/email)", gateRes.items.every((i) => !("id" in i) && !("ownerId" in i) && !("email" in i)));

  // ── 3) Filtrat qytet/kuzhinë/emër ──────────────────────────────────────
  const ft = `z6flt${Date.now().toString(36)}`;
  await makeRestaurant({ tag: `${ft}-a`, name: `${ft} Alpha`, city: "Shkodër", cuisine: "Peshk" });
  await makeRestaurant({ tag: `${ft}-b`, name: `${ft} Beta`, city: "Vlorë", cuisine: "Peshk" });
  await makeRestaurant({ tag: `${ft}-c`, name: `${ft} Gamma`, city: "Shkodër", cuisine: "Pica" });

  const byCity = await searchRestaurants(parseSearchParams({ q: ft, city: "shkodër" }));
  ok("filtri qytet case-insensitive", byCity.total === 2);
  const byCuisine = await searchRestaurants(parseSearchParams({ q: ft, cuisine: "Peshk" }));
  ok("filtri kuzhinë", byCuisine.total === 2);
  const byName = await searchRestaurants(parseSearchParams({ q: `${ft} Alpha` }));
  ok("filtri emër (contains)", byName.total === 1 && byName.items[0].name === `${ft} Alpha`);
  const byBoth = await searchRestaurants(parseSearchParams({ q: ft, city: "Shkodër", cuisine: "Pica" }));
  ok("filtra të kombinuara", byBoth.total === 1 && byBoth.items[0].name === `${ft} Gamma`);

  // ── 4) Facets vetëm nga publike jo-të pezulluara ───────────────────────
  const facets = await getSearchFacets();
  ok("facets përmban qytetet reale", facets.cities.includes("Shkodër") && facets.cities.includes("Vlorë"));
  ok("facets përmban kuzhinat reale", facets.cuisines.includes("Peshk") && facets.cuisines.includes("Pica"));

  // ── 5) Pagination + clamp ──────────────────────────────────────────────
  const pg = `z6pag${Date.now().toString(36)}`;
  const N = PAGE_SIZE + 2;
  for (let i = 0; i < N; i++) {
    await makeRestaurant({ tag: `${pg}-${i}`, name: `${pg} ${String(i).padStart(2, "0")}` });
  }
  const page1 = await searchRestaurants(parseSearchParams({ q: pg, page: "1" }));
  ok("page1 ka PAGE_SIZE items", page1.items.length === PAGE_SIZE && page1.total === N);
  const page2 = await searchRestaurants(parseSearchParams({ q: pg, page: "2" }));
  ok("page2 ka mbetjen", page2.items.length === N - PAGE_SIZE && page2.page === 2);
  const pageOver = await searchRestaurants(parseSearchParams({ q: pg, page: "99" }));
  ok("page mbi kufirin → clamp te faqja e fundit", pageOver.page === pageOver.totalPages);
  ok("rend stabil (asc) mes faqeve", page1.items[0].name < page2.items[page2.items.length - 1].name);

  // ── 6) Disponueshmëria reale (date/persona + timezone) ─────────────────
  const av = `z6av${Date.now().toString(36)}`;
  await makeRestaurant({ tag: `${av}-book`, name: `${av} Bookable`, city: "Tiranë", booking: true, seats: [4] });
  await makeRestaurant({ tag: `${av}-nobook`, name: `${av} NoBooking`, city: "Tiranë" });

  const date = futureDateKey(3);
  const withAvail = await searchRestaurants(parseSearchParams({ q: av, date, guests: "2" }));
  ok("availabilityRequested kur ka date+guests", withAvail.availabilityRequested === true);
  const bookable = withAvail.items.find((i) => i.name === `${av} Bookable`);
  const noBooking = withAvail.items.find((i) => i.name === `${av} NoBooking`);
  ok("restorant me BOOKING → slots nga motori real", !!bookable && bookable.bookingActive && bookable.slots.length > 0);
  ok("slot-et mbartin time+start ISO", !!bookable && bookable.slots.every((s) => /^\d{2}:\d{2}$/.test(s.time) && !Number.isNaN(Date.parse(s.start))));
  ok("slot-et e kufizuara në SLOTS_PER_CARD", !!bookable && bookable.slots.length <= SLOTS_PER_CARD);
  ok("restorant pa BOOKING → pa slots (jo të sajuara)", !!noBooking && noBooking.bookingActive === false && noBooking.slots.length === 0);

  const noAvail = await searchRestaurants(parseSearchParams({ q: av }));
  ok("pa date/guests → availabilityRequested=false dhe pa slots", noAvail.availabilityRequested === false && noAvail.items.every((i) => i.slots.length === 0));

  // slot-et preferojnë orën e kërkuar
  const withTime = await searchRestaurants(parseSearchParams({ q: `${av} Bookable`, date, guests: "2", time: "19:00" }));
  const b2 = withTime.items[0];
  ok("me time → slot-et pranë orës së kërkuar", !!b2 && b2.slots.length > 0 && b2.slots.some((s) => s.time >= "18:00" && s.time <= "20:30"));

  await cleanup();
  console.log(`\n── Faza 6: ${pass} ✅  ${fail} ❌ ──\n`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
