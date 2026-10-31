/*
 * E2E Faza 5 — cikli i rezervimit mbi serverin real: klient rezervon (formular publik)
 * → stafi e sheh/riplanifikon → klienti anulon; plus worker-i i njoftimeve dhe screenshots.
 * Prerekuizitë: `next start` në :3000 mbi Postgres lokal. Dërgimet simulohen (pa email real).
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { updateBookingSettings, setOpeningHours, createArea, createTable, purgeRestaurantBookingData } from "@/modules/booking/config";
import { zonedTimeToUtc, toBusinessDateKey } from "@/modules/booking/timezone";
import bcrypt from "bcryptjs";
import { mkdirSync } from "fs";
import { chromium, launchBrowser } from "./_browser";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const PW = "password123";
const SUF = "@p5e2e.local";
const TZ = "Europe/Tirane";
const SHOT = "/tmp/claude-0/-home-user-onlinemenu-al/0d9e83e4-f355-5b98-bff3-f83d225b57b6/scratchpad/shots5";

(function guard() {
  const url = process.env.DATABASE_URL ?? "";
  const local = url.includes("@localhost") || url.includes("@127.0.0.1");
  if (process.env.ALLOW_NONLOCAL_TEST_DB !== "1" && (!local || /neon\.tech|amazonaws|supabase/i.test(url))) {
    console.error("⛔ E2E vetëm kundrejt DB lokale."); process.exit(2);
  }
})();

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); } }
const problems: string[] = [];

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: users.map((u) => u.id) } }, select: { id: true } });
  for (const r of rests) await purgeRestaurantBookingData(r.id);
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}
function futureDateKey(off: number) { return toBusinessDateKey(new Date(Date.now() + off * 86400000), TZ); }

type Browser = Awaited<ReturnType<typeof chromium.launch>>;
async function login(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PW);
  await page.click("button[type=submit]");
  for (let i = 0; i < 40; i++) { const p = new URL(page.url()).pathname; if (p.startsWith("/dashboard") || p.startsWith("/onboarding")) break; await page.waitForTimeout(250); }
  return { ctx, page };
}
async function shoot(browser: Browser, path: string, name: string, email?: string) {
  for (const vp of [{ w: 390, h: 844, t: "390" }, { w: 1440, h: 900, t: "1440" }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    if (email) {
      await page.goto(`${BASE}/login`); await page.fill("input[type=email]", email); await page.fill("input[type=password]", PW); await page.click("button[type=submit]");
      for (let i = 0; i < 40; i++) { if (!new URL(page.url()).pathname.startsWith("/login")) break; await page.waitForTimeout(200); }
    }
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (m.sw > m.cw + 1) problems.push(`${name}@${vp.t}: ${m.sw}>${m.cw}`);
    await page.screenshot({ path: `${SHOT}/${name}-${vp.t}.png`, fullPage: true });
    console.log(`  ${m.sw > m.cw + 1 ? "⚠️" : "✅"} shot ${name}@${vp.t}`);
    await ctx.close();
  }
}

async function main() {
  mkdirSync(SHOT, { recursive: true });
  await cleanup();
  const D = futureDateKey(4);

  // Seed: restorant i publikuar me BOOKING aktiv, orar, zonë, 2 tavolina.
  const email = `ownerp5${SUF}`.toLowerCase();
  const owner = await prisma.user.create({ data: { email, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) }, select: { id: true } });
  const { restaurantId, slug } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, owner.id, "Resto Faza Pesë"));
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { isPublished: true, phone: "+355671234567" } });
  const sub = await prisma.subscription.findUnique({ where: { restaurantId }, select: { id: true } });
  await prisma.moduleEntitlement.update({ where: { subscriptionId_module: { subscriptionId: sub!.id, module: "BOOKING" } }, data: { status: "active" } });
  await updateBookingSettings(restaurantId, {});
  await setOpeningHours(restaurantId, [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "12:00", endTime: "23:00" })));
  const area = await createArea(restaurantId, { name: "Brenda", kind: "indoor" });
  await createTable(restaurantId, { name: "T1", seats: 4, areaId: area.id });
  await createTable(restaurantId, { name: "T2", seats: 4, areaId: area.id });

  const browser = await launchBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── 1) Profili: butoni Rezervo i brendshëm (BOOKING aktiv) ──
  console.log("\n1. Profili → Rezervo i brendshëm:");
  await page.goto(`${BASE}/restaurants/${slug}`, { waitUntil: "networkidle" });
  ok("butoni Rezervo çon te formulari i brendshëm", (await page.locator(`a[href="/restaurants/${slug}/reserve"]`).count()) > 0);

  // ── 2) Klienti rezervon përmes formularit ──
  console.log("\n2. Klienti rezervon:");
  await page.goto(`${BASE}/restaurants/${slug}/reserve`, { waitUntil: "networkidle" });
  await page.fill('input[type=date]', D);
  await page.locator("select").first().selectOption("2");
  await page.getByRole("button", { name: /Shiko oraret/ }).click();
  await page.waitForSelector(".rsv-slot", { timeout: 8000 });
  ok("u shfaqën orë të lira", (await page.locator(".rsv-slot").count()) > 0);
  await page.locator(".rsv-slot").first().click();
  await page.getByRole("button", { name: /^Vazhdo$/ }).click();
  await page.locator(".rsv-card input").first().fill("Klient");
  await page.locator('input[type=email]').fill("klient@p5e2e.local");
  // Telefoni = inputi i tretë në formularin e kontaktit (emri, mbiemri, telefoni).
  await page.locator(".rsv-card input").nth(2).fill("+355690000999");
  await page.getByRole("button", { name: /Konfirmo rezervimin/ }).click();
  await page.waitForSelector(".rsv-done", { timeout: 8000 });
  ok("u shfaq konfirmimi", (await page.locator(".rsv-done").count()) > 0);

  const resv = await prisma.reservation.findFirst({ where: { restaurantId }, orderBy: { createdAt: "desc" }, select: { id: true, cancelToken: true, startDateTime: true, status: true } });
  ok("rezervimi u krijua në DB", !!resv && resv!.status === "Confirmed");
  ok("job-et e njoftimit u krijuan (konfirmim)", (await prisma.notificationJob.count({ where: { reservationId: resv!.id, type: "BookingConfirmation" } })) >= 1);
  const token = resv!.cancelToken;

  // ── 3) Stafi e sheh dhe e riplanifikon ──
  console.log("\n3. Stafi sheh + riplanifikon:");
  const staff = await login(browser, email);
  await staff.page.goto(`${BASE}/dashboard/reservations`, { waitUntil: "networkidle" });
  await staff.page.fill('input[type=date]', D);
  await staff.page.waitForTimeout(800);
  ok("rezervimi shfaqet te paneli", ((await staff.page.locator("main").textContent()) || "").includes("Klient"));
  const oldStart = resv!.startDateTime.getTime();
  await staff.page.getByRole("button", { name: /Riplanifiko/ }).first().click();
  await staff.page.waitForTimeout(1200); // ngarkohen oraret në modal
  const slotBtns = staff.page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  const n = await slotBtns.count();
  ok("orët e lira u ngarkuan në modal", n > 0, `n=${n}`);
  await slotBtns.last().click(); // orë tjetër
  await staff.page.getByRole("button", { name: /^Riplanifiko$/ }).last().click();
  await staff.page.waitForTimeout(1200);
  const afterResched = await prisma.reservation.findUnique({ where: { id: resv!.id }, select: { startDateTime: true } });
  ok("ora e rezervimit ndryshoi (riplanifikim)", afterResched!.startDateTime.getTime() !== oldStart, `${afterResched!.startDateTime.toISOString()} vs old`);
  ok("job riplanifikimi u krijua", (await prisma.notificationJob.count({ where: { reservationId: resv!.id, type: "Reschedule" } })) >= 1);
  await staff.ctx.close();

  // ── 4) Klienti anulon ──
  console.log("\n4. Klienti anulon:");
  const page2 = await (await browser.newContext()).newPage();
  page2.on("dialog", (d) => d.accept());
  await page2.goto(`${BASE}/bookings/${token}`, { waitUntil: "networkidle" });
  await page2.getByRole("button", { name: /Anulo rezervimin/ }).click();
  await page2.waitForTimeout(1200);
  const afterCancel = await prisma.reservation.findUnique({ where: { id: resv!.id }, select: { status: true } });
  ok("statusi u bë Cancelled", afterCancel!.status === "Cancelled");
  ok("job anulimi u krijua", (await prisma.notificationJob.count({ where: { reservationId: resv!.id, type: "Cancellation" } })) >= 1);

  // ── 5) Njoftimet: dërgimi pas commit-it (worker inline) + cron i mbrojtur ──
  console.log("\n5. Njoftimet (pas commit-it + cron):");
  // Rrugët publike kanë bërë kick worker-it pas commit-it → konfirmimet janë përpunuar
  // (Simulated, pa RESEND real). Kjo dëshmon "krijo në tx → dërgo pas commit-it".
  const confJob = await prisma.notificationJob.findFirst({ where: { reservationId: resv!.id, type: "BookingConfirmation" }, select: { status: true } });
  ok("konfirmimi u dërgua pas commit-it (Simulated/Sent)", confJob?.status === "Simulated" || confJob?.status === "Sent", confJob?.status);
  // Cron pa secret → 401; me secret → 200.
  const noAuth = await page.evaluate(async () => (await fetch("/api/cron/notifications")).status);
  ok("cron pa secret → 401", noAuth === 401, `status=${noAuth}`);
  const cron = await page.evaluate(async () => {
    const r = await fetch("/api/cron/notifications", { headers: { Authorization: "Bearer test-cron" } });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  });
  ok("cron me secret → 200", cron.status === 200, JSON.stringify(cron));
  const pendingLeft = await prisma.notificationJob.count({ where: { restaurantId, status: { in: ["Pending", "Failed"] }, scheduledAt: { lte: new Date() } } });
  ok("asnjë job i gatshëm pa përpunuar", pendingLeft === 0, `left=${pendingLeft}`);

  // ── Screenshots ──
  console.log("\nScreenshots:");
  await shoot(browser, `/restaurants/${slug}/reserve`, "reserve");
  await shoot(browser, `/bookings/${token}`, "booking");
  await shoot(browser, `/dashboard/reservations`, "panel-reservations", email);

  await ctx.close();
  await browser.close();
  await cleanup();
  console.log(`\nOverflow problems: ${problems.length}`); problems.forEach((p) => console.log("  " + p));
  console.log(`\n──────── PHASE 5 E2E: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
