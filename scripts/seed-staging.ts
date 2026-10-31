/*
 * Seed i TË DHËNAVE SINTETIKE për STAGING/Preview (Faza 8) — për provë manuale.
 * Krijon dy restorante demo A/B (të publikuar, me qytet/kuzhinë, menu, booking aktiv,
 * zona/tavolina/orare) + llogari pronari me fjalëkalim të njohur për QA.
 *
 * SIGURI:
 *  - Niset VETËM me STAGING_SEED=1 (opt-in eksplicit). Printon host-in e DB-së para punës.
 *  - Refuzon nëse EMAIL_SEND_LIVE=1 (mos mbill ku shkojnë email realë).
 *  - Pastrimi është i KUFIZUAR te suffix-i `@staging.demo` → nuk prek kurrë të dhëna të tjera.
 *  - Mos e drejto KURRË te DB prod. Të dhënat janë fiktive; asnjë PII reale.
 *
 * Përdorim (kundrejt DB-së staging):
 *   STAGING_SEED=1 DATABASE_URL=... DIRECT_URL=... npx tsx scripts/seed-staging.ts
 */
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { updateBookingSettings, createArea, createTable, setOpeningHours, purgeRestaurantBookingData } from "@/modules/booking/config";
import { setModuleStatus } from "@/modules/subscriptions/modules";

const SUF = "@staging.demo";
const DEMO_PASSWORD = process.env.STAGING_DEMO_PASSWORD || "staging1234";

function dbHost(url: string): string {
  try { return new URL(url).host; } catch { return "(e panjohur)"; }
}

(function guard() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.STAGING_SEED !== "1") {
    console.error("⛔ Nis me STAGING_SEED=1 (opt-in). Host DB:", dbHost(url));
    process.exit(2);
  }
  if (process.env.EMAIL_SEND_LIVE === "1") {
    console.error("⛔ EMAIL_SEND_LIVE=1 — mos mbill të dhëna ku dërgohen email realë.");
    process.exit(2);
  }
  console.log(`▶ Seed staging → DB host: ${dbHost(url)}  (suffix: ${SUF})`);
})();

async function cleanup() {
  // Pastrim i kufizuar vetëm te përdoruesit demo (cascade: restorantet + menu + booking + analytics).
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  // Pastro fillimisht të dhënat e booking-ut (rezervime/tavolina) që FK-të të mos bllokojnë fshirjen.
  for (const r of rests) await purgeRestaurantBookingData(r.id);
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { restaurantId: { in: rests.map((r) => r.id) } }] } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}

const WEEK_HOURS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: "11:00", endTime: "23:00", lastBookingTime: "22:00", isActive: true }));

async function seedRestaurant(tag: string, name: string, city: string, cuisine: string, dishes: [string, string, number][]) {
  const ownerEmail = `owner-${tag}${SUF}`.toLowerCase();
  const owner = await prisma.user.create({
    data: { email: ownerEmail, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) },
    select: { id: true },
  });
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, owner.id, name));
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { isPublished: true, city, cuisine } });

  // Menu: dy kategori me artikuj.
  const catMain = await prisma.category.create({ data: { restaurantId, nameAl: "Pjata kryesore", nameEn: "Mains", sortOrder: 0 } });
  const catDrink = await prisma.category.create({ data: { restaurantId, nameAl: "Pije", nameEn: "Drinks", sortOrder: 1 } });
  for (const [al, en, price] of dishes) {
    await prisma.menuItem.create({ data: { categoryId: catMain.id, nameAl: al, nameEn: en, price, isVisible: true } });
  }
  await prisma.menuItem.create({ data: { categoryId: catDrink.id, nameAl: "Ujë", nameEn: "Water", price: 100, isVisible: true } });

  // BOOKING aktiv PER-RESTORANT (kurrë globalisht).
  await setModuleStatus({ restaurantId, module: "BOOKING", status: "active" });
  await updateBookingSettings(restaurantId, { turnDurationMinutes: 90, seatingBuffer: 15, maxPartySize: 10 });
  const area = await createArea(restaurantId, { name: "Salla", kind: "indoor", isOpen: true });
  await createTable(restaurantId, { name: "T1", seats: 2, areaId: area.id });
  await createTable(restaurantId, { name: "T2", seats: 4, areaId: area.id });
  await createTable(restaurantId, { name: "T3", seats: 6, areaId: area.id });
  await setOpeningHours(restaurantId, WEEK_HOURS);

  const slug = (await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } }))!.slug;
  return { ownerEmail, restaurantId, slug };
}

async function main() {
  await cleanup();

  const A = await seedRestaurant("a", "Te Gurra", "Tiranë", "Tradicionale", [["Tavë Kosi", "Baked Lamb & Yogurt", 700], ["Fërgesë", "Fergese", 550]]);
  const B = await seedRestaurant("b", "Bota e Shijeve", "Durrës", "Peshku", [["Peshk në skarë", "Grilled Fish", 1200], ["Rizoto me fruta deti", "Seafood Risotto", 950]]);

  // Admin demo (opsional) për panelin /admin.
  const adminEmail = `admin${SUF}`.toLowerCase();
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "SUPER_ADMIN", emailVerified: true, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) },
    create: { email: adminEmail, role: "SUPER_ADMIN", emailVerified: true, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) },
  });

  console.log("\n✅ Seed staging gati (fjalëkalimi i përbashkët: " + DEMO_PASSWORD + "):");
  console.log(`   A: ${A.ownerEmail}  → /restaurants/${A.slug}  (r=${A.restaurantId})`);
  console.log(`   B: ${B.ownerEmail}  → /restaurants/${B.slug}  (r=${B.restaurantId})`);
  console.log(`   Admin: ${adminEmail}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
