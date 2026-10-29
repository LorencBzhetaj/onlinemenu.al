/*
 * Teste për Fazën 3 (profil publik, QR resolver, lidhje të jashtme, alergjenë,
 * orare menuje, disponueshmëri). Kundrejt Postgres LOKAL testimi — shih tests/README.md.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { resolveQrCode, ensureQrCode } from "@/modules/restaurants/qr";
import { validateLinkUrl } from "@/modules/restaurants/external-links";
import { isWindowActive } from "@/modules/menu/schedule";
import {
  getPublicProfile,
  getPublicMenuData,
  reserveDestination,
} from "@/modules/restaurants/public-profile";

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
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

const SUF = "@test.local";
async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}
const provision = (ownerId: string, name: string) =>
  prisma.$transaction((tx) => createRestaurantForOwner(tx, ownerId, name));

async function makeOwner(tag: string, name: string) {
  const user = await prisma.user.create({
    data: { email: `${tag}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true },
    select: { id: true },
  });
  const { restaurantId, slug } = await provision(user.id, name);
  return { userId: user.id, restaurantId, slug };
}

async function main() {
  await cleanup();

  // ── 1) Validim i URL-ve të lidhjeve ──
  console.log("\n1. validateLinkUrl:");
  ok("Wolt zyrtar pranohet", validateLinkUrl("WOLT", "https://wolt.com/en/alb/tirana/restaurant/x").ok);
  ok("Wolt subdomain pranohet", validateLinkUrl("WOLT", "https://restaurant.wolt.com/x").ok);
  ok("Wolt host i palejuar refuzohet", !validateLinkUrl("WOLT", "https://evil.com/wolt").ok);
  ok("Wolt http (jo https) refuzohet", !validateLinkUrl("WOLT", "http://wolt.com/x").ok);
  ok("Wolt bosh refuzohet", !validateLinkUrl("WOLT", "").ok);
  ok("Instagram zyrtar pranohet", validateLinkUrl("INSTAGRAM", "https://www.instagram.com/resto").ok);
  ok("Instagram host tjetër refuzohet", !validateLinkUrl("INSTAGRAM", "https://facebook.com/resto").ok);
  ok("Maps google pranohet", validateLinkUrl("MAPS", "https://maps.google.com/?q=x").ok);
  ok("Maps short link pranohet", validateLinkUrl("MAPS", "https://maps.app.goo.gl/abc").ok);
  ok("Maps host tjetër refuzohet", !validateLinkUrl("MAPS", "https://bing.com/maps").ok);
  ok("Website çdo https pranohet", validateLinkUrl("WEBSITE", "https://resto.al").ok);
  ok("Website http refuzohet", !validateLinkUrl("WEBSITE", "http://resto.al").ok);
  ok("URL e keqformuar refuzohet", !validateLinkUrl("WEBSITE", "jo-url").ok);

  // ── 2) Dritaret e orarit ──
  console.log("\n2. isWindowActive (Europe/Tirane):");
  {
    // Ndërto një instant brenda dritares duke përdorur orën aktuale të Tiranës.
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Tirane", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const wk: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = wk[get("weekday")] ?? 0;
    let hour = parseInt(get("hour"), 10); if (hour === 24) hour = 0;
    const minute = parseInt(get("minute"), 10);
    const nowMin = hour * 60 + minute;

    const wide = { days: [0, 1, 2, 3, 4, 5, 6], startMinutes: 0, endMinutes: 1440 };
    ok("dritare 24h gjithë javën → aktive", isWindowActive(wide));

    const todayOnlyOutside = { days: [day], startMinutes: Math.min(nowMin + 60, 1439), endMinutes: 1440 };
    // nëse nowMin+60 >= 1440 ky test s'ka kuptim; anashkalo në atë skaj
    if (nowMin + 60 < 1440) ok("sot por pas orës aktuale → jo aktive", !isWindowActive(todayOnlyOutside));
    else ok("sot por pas orës aktuale → jo aktive (skip skaj)", true);

    const otherDay = { days: [(day + 1) % 7], startMinutes: 0, endMinutes: 1440 };
    ok("ditë tjetër → jo aktive", !isWindowActive(otherDay));

    // Dritare që kalon mesnatën: start 23:59, end 23:58 të nesërmen → gati gjithmonë aktive.
    ok("dritare mbi mesnatë (gati 24h) → aktive", isWindowActive({ days: [0,1,2,3,4,5,6], startMinutes: 1439, endMinutes: 1438 }));
  }

  // ── 3) QR resolver: QR e vjetër, ndryshim emri, kod i panjohur ──
  console.log("\n3. QR resolver:");
  const A = await makeOwner("p3-a", "Resto Alpha");
  await prisma.restaurant.update({ where: { id: A.restaurantId }, data: { isPublished: true } });
  const qr = await prisma.qrCode.findUnique({ where: { restaurantId: A.restaurantId } });
  ok("QR u krijua në provisionim", !!qr);
  const resolved = await resolveQrCode(qr!.code);
  ok("kodi zgjidhet te slug-u", resolved?.slug === A.slug);

  // Ndryshim emri → slug dhe kod QR MBESIN të njëjta (QR e printuar s'prishet).
  await prisma.restaurant.update({ where: { id: A.restaurantId }, data: { name: "Resto Alpha (Re)" } });
  const afterRename = await resolveQrCode(qr!.code);
  ok("pas ndryshimit të emrit kodi ende çon te i njëjti slug", afterRename?.slug === A.slug);

  ok("kod i panjohur → null", (await resolveQrCode("jo-ekziston-xxxx")) === null);

  // ensureQrCode idempotent (restorant pa QR → krijohet; me QR → i njëjti)
  await prisma.qrCode.deleteMany({ where: { restaurantId: A.restaurantId } });
  const c1 = await ensureQrCode(prisma, A.restaurantId);
  const c2 = await ensureQrCode(prisma, A.restaurantId);
  ok("ensureQrCode idempotent", c1 === c2);

  // ── 4) getPublicProfile: gate + lidhje të aktivizuara ──
  console.log("\n4. getPublicProfile:");
  await prisma.restaurantExternalLink.createMany({
    data: [
      { restaurantId: A.restaurantId, type: "WOLT", url: "https://wolt.com/x", enabled: true },
      { restaurantId: A.restaurantId, type: "INSTAGRAM", url: "https://instagram.com/x", enabled: false },
    ],
  });
  const prof = await getPublicProfile(A.slug);
  ok("profili gjendet", !!prof);
  ok("menuActive true (trial)", prof!.gate.menuActive === true);
  ok("bookingActive false (disabled)", prof!.gate.bookingActive === false);
  ok("vetëm lidhjet e aktivizuara", prof!.links.length === 1 && prof!.links[0].type === "WOLT");

  // ── 5) reserveDestination: modul + destinacion funksional ──
  console.log("\n5. reserveDestination:");
  const gateOffBooking = { isPublished: true, suspended: false, menuActive: true, bookingActive: false };
  const gateOnBooking = { isPublished: true, suspended: false, menuActive: true, bookingActive: true };
  ok("BOOKING joaktiv → null", reserveDestination({ gate: gateOffBooking, whatsapp: "355671234567", phone: "+355671234567", name: "X" }) === null);
  ok("BOOKING aktiv + WhatsApp → wa.me", (reserveDestination({ gate: gateOnBooking, whatsapp: "355671234567", phone: null, name: "X" }) ?? "").startsWith("https://wa.me/355671234567"));
  ok("BOOKING aktiv + vetëm telefon → tel:", reserveDestination({ gate: gateOnBooking, whatsapp: null, phone: "+355671234567", name: "X" }) === "tel:+355671234567");
  ok("BOOKING aktiv pa kontakt → null", reserveDestination({ gate: gateOnBooking, whatsapp: null, phone: null, name: "X" }) === null);

  // ── 6) getPublicMenuData: dukshmëri, disponueshmëri, alergjenë, orar ──
  console.log("\n6. getPublicMenuData:");
  const allergen = await prisma.allergen.create({ data: { restaurantId: A.restaurantId, nameAl: "Arra", nameEn: "Nuts", icon: "🥜" } });
  const catAlways = await prisma.category.create({ data: { restaurantId: A.restaurantId, nameAl: "Gjithmonë", nameEn: "Always", sortOrder: 0 } });
  // Artikull i dukshëm + i padisponueshëm + me alergjen
  const it1 = await prisma.menuItem.create({ data: { categoryId: catAlways.id, nameAl: "Pjata 1", nameEn: "Dish 1", price: 500, isVisible: true, isAvailable: false } });
  await prisma.menuItemAllergen.create({ data: { menuItemId: it1.id, allergenId: allergen.id } });
  // Artikull i fshehur → s'duhet të dalë
  await prisma.menuItem.create({ data: { categoryId: catAlways.id, nameAl: "E fshehur", nameEn: "Hidden", price: 400, isVisible: false } });

  // Kategori me orar: dritare që S'është aktive tani (ditë tjetër) → nuk shfaqet.
  const otherDayNum = ((new Date().getDay()) + 1) % 7;
  const sched = await prisma.menuSchedule.create({ data: { restaurantId: A.restaurantId, label: "Vetëm nesër", days: [otherDayNum], startMinutes: 0, endMinutes: 1440 } });
  const catScheduled = await prisma.category.create({ data: { restaurantId: A.restaurantId, nameAl: "Me orar", nameEn: "Scheduled", sortOrder: 1, scheduleId: sched.id } });
  await prisma.menuItem.create({ data: { categoryId: catScheduled.id, nameAl: "Pjata orari", nameEn: "Sched dish", price: 600, isVisible: true } });

  const menu = await getPublicMenuData(A.restaurantId);
  const always = menu.categories.find((c) => c.id === catAlways.id);
  ok("kategoria pa orar shfaqet", !!always);
  ok("artikulli i fshehur përjashtohet", always!.items.length === 1);
  ok("artikulli i padisponueshëm mbetet (i shënuar)", always!.items[0].isAvailable === false);
  ok("alergjeni përcillet", always!.items[0].allergenIds.includes(allergen.id));
  ok("kategoria me orar jashtë dritares fshihet", !menu.categories.find((c) => c.id === catScheduled.id));
  ok("legjenda e alergjenëve përfshihet", menu.allergens.some((a) => a.id === allergen.id));

  // Orar aktiv TANI → kategoria shfaqet.
  await prisma.menuSchedule.update({ where: { id: sched.id }, data: { days: [0,1,2,3,4,5,6], startMinutes: 0, endMinutes: 1440 } });
  const menu2 = await getPublicMenuData(A.restaurantId);
  ok("kategoria me orar brenda dritares shfaqet", !!menu2.categories.find((c) => c.id === catScheduled.id));

  // ── 7) Gate kur MENU joaktiv: menu e fshehur, profil mbetet ──
  console.log("\n7. Gate MENU joaktiv:");
  const sub = await prisma.subscription.findUnique({ where: { restaurantId: A.restaurantId }, select: { id: true } });
  await prisma.moduleEntitlement.update({ where: { subscriptionId_module: { subscriptionId: sub!.id, module: "MENU" } }, data: { status: "disabled" } });
  const profNoMenu = await getPublicProfile(A.slug);
  ok("menuActive false pas çaktivizimit", profNoMenu!.gate.menuActive === false);
  ok("profili ende i publikuar (jo i pezulluar)", profNoMenu!.gate.isPublished === true && profNoMenu!.gate.suspended === false);

  // ── 8) Izolim tenant: alergjeni/orari i një tenant-i tjetër s'i përket këtij ──
  console.log("\n8. Izolim tenant (alergjenë/orare):");
  const B = await makeOwner("p3-b", "Resto Beta");
  const allergenB = await prisma.allergen.create({ data: { restaurantId: B.restaurantId, nameAl: "Qumësht", nameEn: "Milk" } });
  const ownedByA = await prisma.allergen.findFirst({ where: { id: allergenB.id, restaurantId: A.restaurantId } });
  ok("alergjeni i B s'i përket A", ownedByA === null);
  const schedB = await prisma.menuSchedule.findFirst({ where: { id: sched.id, restaurantId: B.restaurantId } });
  ok("orari i A s'i përket B", schedB === null);

  await cleanup();
  console.log(`\n──────── PHASE 3 RESULT: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await prisma.$disconnect();
  process.exit(1);
});
