/*
 * E2E/HTTP + vizual për Fazën 7 (ekipi, abonime/module, audit, analitika) — browser real
 * mbi serverin në këmbë + Postgres LOKAL. Fokus: ftesë → pranim → leje; analitika reale;
 * audit; aktivizim moduli nga admin. Screenshots @390/1440 me kontroll overflow.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { recordEvent } from "@/modules/analytics/events";
import bcrypt from "bcryptjs";
import { mkdirSync } from "fs";
import { chromium, launchBrowser } from "./_browser";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const PW = "password123";
const SUF = "@p7e2e.local";
const SHOT = "/tmp/claude-0/-home-user-onlinemenu-al/0d9e83e4-f355-5b98-bff3-f83d225b57b6/scratchpad/shots7";

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
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { restaurantId: { in: rests.map((r) => r.id) } }] } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}

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
    if (p.startsWith("/dashboard") || p.startsWith("/onboarding") || p.startsWith("/admin")) break;
    await page.waitForTimeout(250);
  }
  return { context, page };
}

async function shoot(browser: Browser, ctxPage: { context: any }, path: string, name: string) {
  for (const vp of [{ w: 390, t: "390" }, { w: 1440, t: "1440" }]) {
    const page = await ctxPage.context.newPage();
    await page.setViewportSize({ width: vp.w, height: vp.w === 390 ? 844 : 900 });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (m.sw > m.cw + 1) problems.push(`${name}@${vp.t}: sw=${m.sw}>${m.cw}`);
    await page.screenshot({ path: `${SHOT}/${name}-${vp.t}.png`, fullPage: true });
    console.log(`  ${m.sw > m.cw + 1 ? "⚠️" : "✅"} shot ${name}@${vp.t} (sw=${m.sw} cw=${m.cw})`);
    await page.close();
  }
}

async function main() {
  mkdirSync(SHOT, { recursive: true });
  await cleanup();

  // ── Seed ──
  const ownerEmail = `owner7${SUF}`.toLowerCase();
  const owner = await prisma.user.create({ data: { email: ownerEmail, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) }, select: { id: true } });
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, owner.id, "Resto Shtatë"));
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { isPublished: true, city: "Tiranë", cuisine: "Tradicionale" } });

  const staffEmail = `staff7${SUF}`.toLowerCase();
  await prisma.user.create({ data: { email: staffEmail, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) } });

  const adminEmail = `admin7${SUF}`.toLowerCase();
  await prisma.user.create({ data: { email: adminEmail, role: "SUPER_ADMIN", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) } });

  // Analitika reale (seed events).
  const cat = await prisma.category.create({ data: { restaurantId, nameAl: "Pjata", nameEn: "Mains", sortOrder: 0 } });
  const dish = await prisma.menuItem.create({ data: { categoryId: cat.id, nameAl: "Tavë Kosi", nameEn: "Tave", price: 700 } });
  for (let i = 0; i < 5; i++) await recordEvent({ restaurantId, type: "profile_view" });
  for (let i = 0; i < 3; i++) await recordEvent({ restaurantId, type: "menu_view" });
  await recordEvent({ restaurantId, type: "wolt_click", meta: "WOLT" });
  for (let i = 0; i < 4; i++) await recordEvent({ restaurantId, type: "item_view", itemId: dish.id });
  await recordEvent({ restaurantId, type: "booking_created" });

  const browser = await launchBrowser();

  // ── T1: OWNER → /dashboard/team → fto staf ──
  console.log("\nT1 ekipi (owner fton staf):");
  const O = await login(browser, ownerEmail);
  await O.page.goto(`${BASE}/dashboard/team?r=${restaurantId}`, { waitUntil: "networkidle" });
  ok("forma e ftesës ekziston (owner)", (await O.page.locator('input[type=email]').count()) > 0);
  await O.page.fill('input[type=email]', staffEmail);
  await O.page.selectOption('select', "STAFF");
  await O.page.click('button[type=submit]');
  await O.page.waitForSelector("code", { timeout: 5000 }).catch(() => {});
  const inviteUrl = (await O.page.locator("code").first().textContent().catch(() => "")) || "";
  ok("ftesa ktheu një URL", /\/invite\//.test(inviteUrl), inviteUrl);
  const token = inviteUrl.split("/invite/")[1]?.trim() ?? "";

  // ── T2: Analitika reale ──
  console.log("\nT2 analitika reale:");
  await O.page.goto(`${BASE}/dashboard/analytics?r=${restaurantId}`, { waitUntil: "networkidle" });
  const an = (await O.page.locator("main").textContent()) || "";
  ok("shfaqet shikime profili", an.includes("Shikime profili"));
  ok("shfaqet 'Klikime Wolt' (jo porosi)", an.includes("Klikime Wolt"));
  ok("pjata më e klikuar shfaqet", an.includes("Tavë Kosi"));

  // ── T3: STAF pranon ftesën → leje të kufizuara ──
  console.log("\nT3 pranimi + lejet e stafit:");
  const S = await login(browser, staffEmail);
  await S.page.goto(`${BASE}/invite/${token}`, { waitUntil: "networkidle" });
  const accBtn = S.page.locator("button", { hasText: "Bashkohu" });
  ok("butoni i pranimit shfaqet (email përputhet)", (await accBtn.count()) > 0);
  if (await accBtn.count()) {
    await accBtn.first().click();
    await S.page.waitForTimeout(1200);
    ok("pas pranimit → dashboard", new URL(S.page.url()).pathname.startsWith("/dashboard"), S.page.url());
  }
  const mem = await prisma.restaurantMembership.findFirst({ where: { restaurantId, user: { email: staffEmail } }, select: { role: true, status: true } });
  ok("membership STAFF aktiv u krijua", mem?.role === "STAFF" && mem?.status === "active");
  // Staf → /dashboard/team duhet të refuzohet (team:read vetëm OWNER).
  await S.page.goto(`${BASE}/dashboard/team?r=${restaurantId}`, { waitUntil: "networkidle" });
  ok("stafi s'menaxhon ekipin (pa formë ftese)", (await S.page.locator('button[type=submit]').count()) === 0);

  // ── T4: Admin audit + aktivizim moduli ──
  console.log("\nT4 admin audit + module:");
  const AD = await login(browser, adminEmail);
  await AD.page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  const audit = (await AD.page.locator("main").textContent()) || "";
  ok("audit shfaq team.invite", audit.includes("team.invite"));
  ok("audit shfaq team.accept", audit.includes("team.accept"));
  // Aktivizo BOOKING nga admin detail.
  await AD.page.goto(`${BASE}/admin/restaurants/${restaurantId}`, { waitUntil: "networkidle" });
  await AD.page.waitForTimeout(700); // prit hydration-in e ModulesForm para klikimit
  // Tekst EKZAKT: "Aktivizo" (jo "Çaktivizo", që e përmban si nënvarg) → rreshti i BOOKING.
  const actBtn = AD.page.getByRole("button", { name: "Aktivizo", exact: true });
  ok("butoni Aktivizo ekziston", (await actBtn.count()) > 0);
  if (await actBtn.count()) {
    await actBtn.first().click();
    // Prit derisa statusi të bëhet active në DB (router.refresh pas PUT).
    for (let i = 0; i < 20; i++) {
      const b = await prisma.moduleEntitlement.findFirst({ where: { subscription: { restaurantId }, module: "BOOKING" }, select: { status: true } });
      if (b?.status === "active") break;
      await AD.page.waitForTimeout(250);
    }
  }
  const booking = await prisma.moduleEntitlement.findFirst({ where: { subscription: { restaurantId }, module: "BOOKING" }, select: { status: true } });
  ok("BOOKING u aktivizua (per-restorant)", booking?.status === "active");
  const auditRows = await prisma.auditLog.count({ where: { restaurantId, action: "module.activate" } });
  ok("audit regjistroi module.activate", auditRows >= 1);

  // ── Screenshots ──
  console.log("\nScreenshots:");
  await shoot(browser, O, `/dashboard/team?r=${restaurantId}`, "team");
  await shoot(browser, O, `/dashboard/analytics?r=${restaurantId}`, "analytics");
  await shoot(browser, AD, `/admin/audit`, "audit");

  await O.context.close();
  await S.context.close();
  await AD.context.close();
  await browser.close();
  await cleanup();
  console.log(`\nOverflow problems: ${problems.length}`);
  problems.forEach((p) => console.log("  " + p));
  console.log(`\n──────── PHASE 7 E2E: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
