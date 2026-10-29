/*
 * E2E/HTTP + vizual për Fazën 3 — browser real kundrejt serverit në këmbë mbi
 * PostgreSQL LOKAL. Prerekuizitë: `next start` në :3000 me të njëjtën DATABASE_URL.
 * Mbulon: QR→profil, alias /m/[slug]→profil, profil/menu/info, lidhje Wolt, rezervim
 * i gated-uar, kërkim pjatash, alergjenë, disponueshmëri, orar, dhe kontrolle aksesi
 * për API-të e reja. Screenshots @390/1440 me kontroll overflow.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { ensureQrCode } from "@/modules/restaurants/qr";
import bcrypt from "bcryptjs";
import { mkdirSync } from "fs";
import pw from "/opt/node-tools/node_modules/playwright/index.js";
const { chromium } = pw as typeof import("playwright");

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const PW = "password123";
const SUF = "@p3e2e.local";
const SHOT = "/tmp/claude-0/-home-user-onlinemenu-al/0d9e83e4-f355-5b98-bff3-f83d225b57b6/scratchpad/shots3";

(function guard() {
  const url = process.env.DATABASE_URL ?? "";
  const local = url.includes("@localhost") || url.includes("@127.0.0.1");
  if (process.env.ALLOW_NONLOCAL_TEST_DB !== "1" && (!local || /neon\.tech|amazonaws|supabase/i.test(url))) {
    console.error("⛔ E2E lejohet vetëm kundrejt DB lokale."); process.exit(2);
  }
})();

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}
const problems: string[] = [];

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}
const provision = (ownerId: string, name: string) =>
  prisma.$transaction((tx) => createRestaurantForOwner(tx, ownerId, name));

type Browser = Awaited<ReturnType<typeof chromium.launch>>;

async function login(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PW);
  await page.click("button[type=submit]");
  for (let i = 0; i < 40; i++) {
    const p = new URL(page.url()).pathname;
    if (p.startsWith("/dashboard") || p.startsWith("/onboarding")) break;
    await page.waitForTimeout(250);
  }
  return { context, page };
}

async function apiReq(page: any, method: string, path: string, rid: string | null, data?: unknown): Promise<number> {
  return page.evaluate(
    async (a: { method: string; path: string; rid: string | null; data?: unknown }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (a.rid) headers["x-restaurant-id"] = a.rid;
      const res = await fetch(a.path, { method: a.method, headers, body: a.data ? JSON.stringify(a.data) : undefined });
      return res.status;
    },
    { method, path, rid, data }
  );
}

async function shoot(browser: Browser, path: string, name: string) {
  for (const vp of [{ w: 390, h: 844, t: "390" }, { w: 1440, h: 900, t: "1440" }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const overflow = m.sw > m.cw + 1;
    if (overflow) problems.push(`${name}@${vp.t}: scrollW=${m.sw} > ${m.cw}`);
    await page.screenshot({ path: `${SHOT}/${name}-${vp.t}.png`, fullPage: true });
    console.log(`  ${overflow ? "⚠️" : "✅"} shot ${name}@${vp.t} (sw=${m.sw} cw=${m.cw})`);
    await ctx.close();
  }
}

async function main() {
  mkdirSync(SHOT, { recursive: true });
  await cleanup();

  // ── Seed: restorant A i publikuar, me menu + alergjen + orar + tasting + lidhje ──
  const ownerEmail = `ownerp3${SUF}`.toLowerCase();
  const owner = await prisma.user.create({
    data: { email: ownerEmail, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) },
    select: { id: true },
  });
  const { restaurantId, slug } = await provision(owner.id, "Resto Faza Tre");
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { isPublished: true, phone: "+355671112233", whatsapp: "355671112233", address: "Theth, Shkodër", aboutAl: "Restorant tradicional.", aboutEn: "Traditional restaurant." },
  });
  const code = await ensureQrCode(prisma, restaurantId);

  const allergen = await prisma.allergen.create({ data: { restaurantId, nameAl: "Arra", nameEn: "Nuts", icon: "🥜" } });
  const cat = await prisma.category.create({ data: { restaurantId, nameAl: "Pjata Kryesore", nameEn: "Mains", sortOrder: 0 } });
  const dish = await prisma.menuItem.create({ data: { categoryId: cat.id, nameAl: "Tavë Kosi", nameEn: "Tave Kosi", price: 700, isVisible: true, isAvailable: true } });
  await prisma.menuItemAllergen.create({ data: { menuItemId: dish.id, allergenId: allergen.id } });
  await prisma.menuItem.create({ data: { categoryId: cat.id, nameAl: "Byrek", nameEn: "Byrek", price: 300, isVisible: true, isAvailable: false } });
  // Kategori me orar aktiv tani (gjithë javën, 24h).
  const sched = await prisma.menuSchedule.create({ data: { restaurantId, label: "Gjithë ditën", days: [0,1,2,3,4,5,6], startMinutes: 0, endMinutes: 1440 } });
  const catS = await prisma.category.create({ data: { restaurantId, nameAl: "Mëngjesi", nameEn: "Breakfast", sortOrder: 1, scheduleId: sched.id } });
  await prisma.menuItem.create({ data: { categoryId: catS.id, nameAl: "Petulla", nameEn: "Pancakes", price: 250, isVisible: true } });
  await prisma.tastingMenu.create({ data: { restaurantId, name: "Menu Malësore", price: 2500, guestCount: 2, courses: [{ titleAl: "Hyrje", titleEn: "Starter", descAl: "Sallatë", descEn: "Salad" }] } });
  await prisma.restaurantExternalLink.createMany({
    data: [
      { restaurantId, type: "WOLT", url: "https://wolt.com/en/alb/tirana/restaurant/resto", enabled: true },
      { restaurantId, type: "INSTAGRAM", url: "https://instagram.com/resto", enabled: true },
      { restaurantId, type: "MAPS", url: "https://maps.app.goo.gl/abc", enabled: true },
    ],
  });

  // Restorant i dytë jo i publikuar (për gate).
  const owner2 = await prisma.user.create({ data: { email: `owner2p3${SUF}`.toLowerCase(), role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) }, select: { id: true } });
  const r2 = await provision(owner2.id, "Resto E Fshehur");

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── T1: QR resolver → profil ──
  console.log("\nT1 QR resolver /q/[code] → profil:");
  await page.goto(`${BASE}/q/${code}`);
  await page.waitForTimeout(500);
  ok("QR çon te /restaurants/[slug]", new URL(page.url()).pathname === `/restaurants/${slug}`, page.url());

  // ── T2: alias /m/[slug] → profil ──
  console.log("\nT2 /m/[slug] → profil:");
  await page.goto(`${BASE}/m/${slug}`);
  await page.waitForTimeout(500);
  ok("alias çon te profili", new URL(page.url()).pathname === `/restaurants/${slug}`, page.url());

  // ── T3: profili ──
  console.log("\nT3 profili:");
  await page.goto(`${BASE}/restaurants/${slug}`, { waitUntil: "networkidle" });
  const body3 = (await page.textContent("body")) || "";
  ok("emri shfaqet", body3.includes("Resto Faza Tre"));
  ok("butoni Menuja ekziston", (await page.locator(`a[href="/restaurants/${slug}/menu"]`).count()) > 0);
  ok("lidhja Wolt (jashtme) ekziston", (await page.locator('a[href*="wolt.com"]').count()) > 0);
  ok("rezervimi NUK shfaqet (BOOKING joaktiv)", !body3.toLowerCase().includes("rezervo"));
  ok("telefoni (tel:) shfaqet", (await page.locator('a[href^="tel:"]').count()) > 0);

  // ── T4: menuja (kërkim, alergjen, disponueshmëri) ──
  console.log("\nT4 menuja:");
  await page.goto(`${BASE}/restaurants/${slug}/menu`, { waitUntil: "networkidle" });
  const body4 = (await page.textContent("body")) || "";
  ok("artikulli shfaqet", body4.includes("Tavë Kosi"));
  ok("chip alergjeni shfaqet", body4.includes("Arra"));
  ok("badge i padisponueshëm shfaqet", body4.toLowerCase().includes("padisponueshëm"));
  ok("kategoria me orar aktiv shfaqet", body4.includes("Petulla"));
  // Kërkim — lexo vetëm përmbajtjen e dukshme (<main>), jo payload-in RSC te <body>.
  await page.fill('input[type=search]', "Tavë");
  await page.waitForTimeout(300);
  const search = (await page.locator("main").textContent()) || "";
  ok("kërkimi gjen 'Tavë'", search.includes("Tavë Kosi") && !search.includes("Petulla"), search.slice(0, 120));
  await page.fill('input[type=search]', "zzzznone");
  await page.waitForTimeout(300);
  ok("kërkim pa rezultate → mesazh bosh", ((await page.locator("main").textContent()) || "").includes("Asnjë pjatë"));

  // ── T5: informacioni ──
  console.log("\nT5 informacioni:");
  await page.goto(`${BASE}/restaurants/${slug}/info`, { waitUntil: "networkidle" });
  const body5 = (await page.textContent("body")) || "";
  ok("adresa shfaqet", body5.includes("Theth"));
  ok("telefoni shfaqet", (await page.locator('a[href^="tel:"]').count()) > 0);
  ok("lidhja Wolt në info", (await page.locator('a[href*="wolt.com"]').count()) > 0);

  // ── T6: profil jo i publikuar → jo aktiv ──
  console.log("\nT6 profil jo i publikuar:");
  await page.goto(`${BASE}/restaurants/${r2.slug}`, { waitUntil: "networkidle" });
  ok("profili jo i publikuar → jo aktiv", ((await page.textContent("body")) || "").toLowerCase().includes("jo aktiv"));

  // ── T7: kontroll aksesi për API-të e reja ──
  console.log("\nT7 akses API (links/allergens):");
  // Unauthenticated
  ok("links PUT pa sesion → 401", (await apiReq(page, "PUT", "/api/dashboard/links", restaurantId, { type: "WEBSITE", url: "https://x.al" })) === 401);

  const A = await login(browser, ownerEmail);
  ok("allergens POST pa header → 400", (await apiReq(A.page, "POST", "/api/dashboard/allergens", null, { nameAl: "X", nameEn: "X" })) === 400);
  ok("allergens POST header tenant tjetër → 403", (await apiReq(A.page, "POST", "/api/dashboard/allergens", r2.restaurantId, { nameAl: "X", nameEn: "X" })) === 403);
  ok("allergens POST header i vet → 201", (await apiReq(A.page, "POST", "/api/dashboard/allergens", restaurantId, { nameAl: "Qumësht", nameEn: "Milk" })) === 201);
  ok("links PUT URL e palejuar (Wolt jo-zyrtar) → 400", (await apiReq(A.page, "PUT", "/api/dashboard/links", restaurantId, { type: "WOLT", url: "https://evil.com/x" })) === 400);
  ok("links PUT http → 400", (await apiReq(A.page, "PUT", "/api/dashboard/links", restaurantId, { type: "WEBSITE", url: "http://x.al" })) === 400);
  await A.context.close();

  // ── Screenshots @390/1440 ──
  console.log("\nScreenshots:");
  await shoot(browser, `/restaurants/${slug}`, "profile");
  await shoot(browser, `/restaurants/${slug}/menu`, "menu");
  await shoot(browser, `/restaurants/${slug}/info`, "info");

  await ctx.close();
  await browser.close();
  await cleanup();
  console.log(`\nOverflow problems: ${problems.length}`);
  problems.forEach((p) => console.log("  " + p));
  console.log(`\n──────── PHASE 3 E2E: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
