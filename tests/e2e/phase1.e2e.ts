/*
 * E2E/HTTP për Fazën 1 — browser real (cookie sesioni), kundrejt serverit në këmbë
 * mbi PostgreSQL LOKAL. Prerekuizitë: `next start` në :3000 me të njëjtën DATABASE_URL.
 *   Nis: tests/e2e/README ose docs/IMPLEMENTATION-STATUS §E2E.
 * Guard-i i DB-së zbatohet (ky skript shkruan/fshin të dhëna testi @e2e.local).
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import bcrypt from "bcryptjs";
// Playwright global (CommonJS default import).
import pw from "/opt/node-tools/node_modules/playwright/index.js";
const { chromium } = pw as typeof import("playwright");

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const PW = "password123";
const SUF = "@e2e.local";

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

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}
const provision = (ownerId: string, name: string) =>
  prisma.$transaction((tx) => createRestaurantForOwner(tx, ownerId, name));

async function mkOwner(tag: string, name: string, published = false) {
  const email = `${tag}${SUF}`.toLowerCase(); // login normalizon email → ruaje lowercase
  const user = await prisma.user.create({
    data: { email, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) },
    select: { id: true },
  });
  const { restaurantId, slug } = await provision(user.id, name);
  if (published) await prisma.restaurant.update({ where: { id: restaurantId }, data: { isPublished: true } });
  const cat = await prisma.category.create({ data: { restaurantId, nameAl: `${name} Kat`, nameEn: `${name} Cat` } });
  await prisma.menuItem.create({ data: { categoryId: cat.id, nameAl: "Pjatë", nameEn: "Dish", price: 500, isVisible: true } });
  return { userId: user.id, restaurantId, slug, catId: cat.id, email };
}
async function mkMember(tag: string, restaurantId: string, role: string, status = "active") {
  const email = `${tag}${SUF}`.toLowerCase();
  const u = await prisma.user.create({
    data: { email, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) },
    select: { id: true },
  });
  await prisma.restaurantMembership.create({ data: { userId: u.id, restaurantId, role, status } });
  return { userId: u.id, email };
}

type Browser = Awaited<ReturnType<typeof chromium.launch>>;
async function login(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PW);
  await page.click("button[type=submit]");
  // router.push është navigim klient (pa event 'load') → bëj poll të URL-së, mos prit 'load'.
  for (let i = 0; i < 40; i++) {
    const p = new URL(page.url()).pathname;
    if (p.startsWith("/dashboard") || p.startsWith("/onboarding")) break;
    await page.waitForTimeout(250);
  }
  const p = new URL(page.url()).pathname;
  if (!p.startsWith("/dashboard") && !p.startsWith("/onboarding")) {
    const err = await page.textContent("body").catch(() => "");
    throw new Error(`login dështoi për ${email}: URL=${page.url()} | faqe: ${(err || "").replace(/\s+/g, " ").slice(0, 200)}`);
  }
  return { context, page };
}
// Kërkesë nga BROWSER-i (fetch same-origin → bart cookie-t e sesionit), si useApiFetch.
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
const apiPost = (page: any, path: string, rid: string | null, data: unknown) => apiReq(page, "POST", path, rid, data);

async function main() {
  await cleanup();
  const A = await mkOwner("ownerA", "Resto A", true);
  const B = await mkOwner("ownerB", "Resto B", true);
  const mgrA = await mkMember("mgrA", A.restaurantId, "MANAGER");
  const staffA = await mkMember("staffA", A.restaurantId, "STAFF");
  const revokedA = await mkMember("revokedA", A.restaurantId, "MANAGER", "revoked");
  // multi = anëtar i A dhe B (për two-tab); zotëron edhe restorantin e vet.
  const multi = await mkOwner("multi", "Resto M");
  await prisma.restaurantMembership.create({ data: { userId: multi.userId, restaurantId: A.restaurantId, role: "MANAGER" } });
  await prisma.restaurantMembership.create({ data: { userId: multi.userId, restaurantId: B.restaurantId, role: "MANAGER" } });

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome" });

  // ── T1: OWNER A — header i mirë/i keq/i munguar ──
  console.log("\nT1 OWNER A header validim:");
  {
    const { page } = await login(browser, A.email);
    ok("POST categories header=A → 201", (await apiPost(page, "/api/categories", A.restaurantId, { nameAl: "X", nameEn: "X" })) === 201);
    ok("POST categories header=B → 403 (s'është anëtar)", (await apiPost(page, "/api/categories", B.restaurantId, { nameAl: "X", nameEn: "X" })) === 403);
    ok("POST categories pa header → 400", (await apiPost(page, "/api/categories", null, { nameAl: "X", nameEn: "X" })) === 400);
    // ID objekti të tenant-it tjetër
    ok("PUT kategori të B me header=A → 403", (await apiReq(page, "PUT", `/api/categories/${B.catId}`, A.restaurantId, { nameAl: "Y", nameEn: "Y" })) === 403);
  }

  // ── T2: parent ID i tenant-it tjetër ──
  console.log("\nT2 parent id i tenant-it tjetër:");
  {
    const { page } = await login(browser, A.email);
    ok("subcategory me categoryId të B (header=A) → 403", (await apiPost(page, "/api/subcategories", A.restaurantId, { categoryId: B.catId, nameAl: "S", nameEn: "S" })) === 403);
    ok("menu-item me categoryId të B (header=A) → 403", (await apiPost(page, "/api/menu-items", A.restaurantId, { categoryId: B.catId, nameAl: "I", nameEn: "I", price: 100 })) === 403);
  }

  // ── T3: MANAGER / STAFF / revoked ──
  console.log("\nT3 rol dhe revokim:");
  {
    const m = await login(browser, mgrA.email);
    ok("MANAGER menu:write → 201", (await apiPost(m.page, "/api/categories", A.restaurantId, { nameAl: "M", nameEn: "M" })) === 201);
    await m.page.goto(`${BASE}/dashboard/billing?r=${A.restaurantId}`);
    ok("MANAGER billing page → 'nuk ka akses'", (await m.page.textContent("body"))?.includes("nuk ka akses") === true);

    const s = await login(browser, staffA.email);
    ok("STAFF menu:write → 403", (await apiPost(s.page, "/api/categories", A.restaurantId, { nameAl: "S", nameEn: "S" })) === 403);

    const rv = await login(browser, revokedA.email);
    ok("revoked menu:write → 403", (await apiPost(rv.page, "/api/categories", A.restaurantId, { nameAl: "R", nameEn: "R" })) === 403);
  }

  // ── T4: Modul MENU joaktiv → shkrim 403, publik 'jo aktive' (pa cache i vjetëruar) ──
  console.log("\nT4 module inactive + public cache:");
  {
    const subA = (await prisma.subscription.findUnique({ where: { restaurantId: A.restaurantId }, select: { id: true } }))!;
    const setMenu = (status: string) => prisma.moduleEntitlement.update({ where: { subscriptionId_module: { subscriptionId: subA.id, module: "MENU" } }, data: { status } });
    const { page } = await login(browser, A.email);
    await setMenu("disabled");
    ok("MENU disabled → shkrim 403 MODULE_INACTIVE", (await apiPost(page, "/api/categories", A.restaurantId, { nameAl: "Z", nameEn: "Z" })) === 403);
    // Publik: force-dynamic → reflektohet menjëherë.
    const pub = await browser.newContext();
    const pp = await pub.newPage();
    await pp.goto(`${BASE}/m/${A.slug}`);
    ok("publik me MENU disabled → 'jo aktive'", (await pp.textContent("body"))?.includes("jo aktive") === true);
    await setMenu("active");
    await pp.goto(`${BASE}/m/${A.slug}`);
    ok("publik me MENU active → shfaq menunë (pa cache i vjetër)", (await pp.textContent("body"))?.includes("Pjatë") === true);
    // Suspension
    await prisma.restaurant.update({ where: { id: A.restaurantId }, data: { suspendedAt: new Date() } });
    await pp.goto(`${BASE}/m/${A.slug}`);
    ok("publik me suspendedAt → 'jo aktive'", (await pp.textContent("body"))?.includes("jo aktive") === true);
    await prisma.restaurant.update({ where: { id: A.restaurantId }, data: { suspendedAt: null } });
    await pub.close();
  }

  // ── T5: Two-tab — shkrimi/leximi mbeten te A edhe kur aktivi global kalon te B ──
  console.log("\nT5 two-tab (write/read stay at A):");
  {
    const { context, page: tab1 } = await login(browser, multi.email);
    const tab2 = await context.newPage(); // i njëjti sesion (cookie i përbashkët)

    await tab1.goto(`${BASE}/dashboard/settings?r=${A.restaurantId}`);
    ok("tab1 shfaq A (SSR read me ?r=A)", (await tab1.textContent("body"))?.includes("Resto A") === true);

    // tab2: kalo aktivin global te B (si zgjedhja në tab tjetër).
    await tab2.request.post(`${BASE}/api/dashboard/active-restaurant`, { headers: { "Content-Type": "application/json" }, data: { restaurantId: B.restaurantId } });

    // tab1 (ende ?r=A) bën një SHKRIM si useApiFetch (lexon ?r nga URL) → duhet të shkojë te A.
    const status = await tab1.evaluate(async () => {
      const r = new URLSearchParams(location.search).get("r");
      const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json", "x-restaurant-id": r || "" }, body: JSON.stringify({ nameAl: "TwoTab", nameEn: "TwoTab" }) });
      return res.status;
    });
    ok("tab1 shkrim → 201 (header=A nga ?r)", status === 201);
    const inA = await prisma.category.count({ where: { restaurantId: A.restaurantId, nameAl: "TwoTab" } });
    const inB = await prisma.category.count({ where: { restaurantId: B.restaurantId, nameAl: "TwoTab" } });
    ok("kategoria u krijua te A, JO te B", inA === 1 && inB === 0, `A=${inA} B=${inB}`);

    // Refresh i tab1: ende ?r=A → lexon A (jo B, pavarësisht aktivit global=B).
    await tab1.reload();
    ok("pas refresh tab1 ende shfaq A", (await tab1.textContent("body"))?.includes("Resto A") === true);

    // Navigim brenda tab1: ruan ?r=A.
    await tab1.click('a[href*="/dashboard/menu"]');
    await tab1.waitForURL((u) => u.pathname.includes("/dashboard/menu"), { timeout: 10000 }).catch(() => {});
    ok("navigimi ruan ?r=A në URL", tab1.url().includes(`r=${A.restaurantId}`));
  }

  await browser.close();
  await cleanup();
  console.log(`\n──────── E2E RESULT: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
