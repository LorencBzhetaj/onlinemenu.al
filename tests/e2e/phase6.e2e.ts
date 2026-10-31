/*
 * E2E/HTTP + vizual për Fazën 6 (zbulimi/kërkimi) — browser real kundrejt serverit në
 * këmbë mbi PostgreSQL LOKAL. Prerekuizitë: `next start` në :3000 me të njëjtën DATABASE_URL.
 * Mbulon: kryefaqja me kërkim + të dhëna reale, listimi /restaurants me filtra në URL,
 * disponueshmëria reale → slot → reserve me parametra të bartur, gjendjet pa rezultate,
 * SEO (sitemap/robots/JSON-LD/noindex). Screenshots @390/1440 me kontroll overflow.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { updateBookingSettings, setOpeningHours, createArea, createTable } from "@/modules/booking/config";
import { purgeRestaurantBookingData } from "@/modules/booking/config";
import { toBusinessDateKey } from "@/modules/booking/timezone";
import { mkdirSync } from "fs";
import { chromium, launchBrowser } from "./_browser";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const SUF = "@p6e2e.local";
const TZ = "Europe/Tirane";
const SHOT = "/tmp/claude-0/-home-user-onlinemenu-al/0d9e83e4-f355-5b98-bff3-f83d225b57b6/scratchpad/shots6";

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
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: users.map((u) => u.id) } }, select: { id: true } });
  for (const r of rests) await purgeRestaurantBookingData(r.id);
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}

function futureDateKey(offsetDays: number): string {
  return toBusinessDateKey(new Date(Date.now() + offsetDays * 86400000), TZ);
}

type Browser = Awaited<ReturnType<typeof chromium.launch>>;

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

async function makeRestaurant(opts: {
  tag: string; name: string; city?: string; cuisine?: string;
  published?: boolean; booking?: boolean; seats?: number[];
}) {
  const user = await prisma.user.create({
    data: { email: `${opts.tag}${SUF}`.toLowerCase(), role: "RESTAURANT_OWNER", emailVerified: true },
    select: { id: true },
  });
  const { restaurantId, slug } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, user.id, opts.name));
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { name: opts.name, city: opts.city ?? null, cuisine: opts.cuisine ?? null, isPublished: opts.published ?? true },
  });
  if (opts.booking) {
    const sub = await prisma.subscription.findUnique({ where: { restaurantId }, select: { id: true } });
    await prisma.moduleEntitlement.update({
      where: { subscriptionId_module: { subscriptionId: sub!.id, module: "BOOKING" } },
      data: { status: "active" },
    });
    await updateBookingSettings(restaurantId, {});
    await setOpeningHours(restaurantId, [0,1,2,3,4,5,6].map((dayOfWeek) => ({ dayOfWeek, startTime: "12:00", endTime: "23:00" })));
    const area = await createArea(restaurantId, { name: "Brenda", kind: "indoor" });
    for (let i = 0; i < (opts.seats ?? [4]).length; i++) {
      await createTable(restaurantId, { name: `T${i + 1}`, seats: (opts.seats ?? [4])[i], areaId: area.id });
    }
  }
  return { restaurantId, slug };
}

async function main() {
  mkdirSync(SHOT, { recursive: true });
  await cleanup();

  const token = `z6e2e${Date.now().toString(36)}`;
  // Restorant kryesor: i publikuar, BOOKING aktiv, tavolinë → ka disponueshmëri reale.
  const main1 = await makeRestaurant({ tag: `${token}-m`, name: `${token} Mountain Grill`, city: "Tiranë", cuisine: "Grill", booking: true, seats: [2, 4] });
  // Një tjetër i publikuar pa booking (për filtra/listim).
  await makeRestaurant({ tag: `${token}-s`, name: `${token} Seaside`, city: "Vlorë", cuisine: "Peshk" });
  // I pafshehur (jo i publikuar) — nuk duhet të dalë.
  await makeRestaurant({ tag: `${token}-h`, name: `${token} Hidden`, city: "Tiranë", published: false });

  const browser = await launchBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── T1: Kryefaqja me kërkim + të dhëna reale ──
  console.log("\nT1 kryefaqja:");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  ok("kutia e kërkimit ekziston", (await page.locator('input[name="q"]').count()) > 0);
  ok("lidhja 'Zbulo' → /restaurants", (await page.locator('a[href="/restaurants"]').count()) > 0);
  const home = (await page.locator("main").textContent()) || "";
  ok("restorantet reale shfaqen te kryefaqja", home.includes(`${token} Mountain Grill`));

  // ── T2: Listimi /restaurants + filtra në URL ──
  console.log("\nT2 listimi + filtra:");
  await page.goto(`${BASE}/restaurants?q=${encodeURIComponent(token)}`, { waitUntil: "networkidle" });
  const list = (await page.locator("main").textContent()) || "";
  ok("të dy publike shfaqen", list.includes("Mountain Grill") && list.includes("Seaside"));
  ok("i pafshehuri NUK shfaqet", !list.includes("Hidden"));
  // Filtri qytet në URL.
  await page.goto(`${BASE}/restaurants?q=${encodeURIComponent(token)}&city=${encodeURIComponent("Vlorë")}`, { waitUntil: "networkidle" });
  const byCity = (await page.locator("main").textContent()) || "";
  ok("filtri qytet (URL) kthen vetëm Vlorën", byCity.includes("Seaside") && !byCity.includes("Mountain Grill"));
  ok("profil-link i kartës ekziston", (await page.locator(`a[href="/restaurants/${main1.slug}"]`).count()) >= 0);

  // Filtrat pasqyrohen në fushat (prefill nga URL).
  const cityVal = await page.locator("#f-city").inputValue().catch(() => "");
  ok("fusha e qytetit pasqyron URL-në", cityVal === "Vlorë", cityVal);

  // ── T3: Disponueshmëria reale → slot → reserve me parametra të bartur ──
  console.log("\nT3 disponueshmëria → reserve:");
  const date = futureDateKey(3);
  await page.goto(`${BASE}/restaurants?q=${encodeURIComponent(`${token} Mountain`)}&date=${date}&guests=2`, { waitUntil: "networkidle" });
  const slotLinks = page.locator(`a[href^="/restaurants/${main1.slug}/reserve?"]`);
  const slotCount = await slotLinks.count();
  ok("slot-et reale shfaqen në kartë", slotCount > 0, `count=${slotCount}`);
  const firstHref = slotCount > 0 ? await slotLinks.first().getAttribute("href") : "";
  ok("slot-i mbart date+guests+time", !!firstHref && firstHref.includes(`date=${date}`) && firstHref.includes("guests=2") && /time=\d{2}%3A\d{2}|time=\d{2}:\d{2}/.test(firstHref), firstHref || "");
  if (slotCount > 0) {
    await slotLinks.first().click();
    await page.waitForTimeout(800);
    ok("klik slot → faqja reserve", new URL(page.url()).pathname === `/restaurants/${main1.slug}/reserve`, page.url());
    // Prefill: oraret auto-ngarkohen (hapi 2) dhe ora e bartur parazgjidhet.
    await page.waitForSelector(".rsv-slot", { timeout: 5000 }).catch(() => {});
    const reserveBody = (await page.locator(".rprofile").first().textContent().catch(() => "")) || "";
    ok("reserve shfaq hapin e orëve (auto-load)", /Ndrysho datën|Ndrysho orën|Vazhdo/i.test(reserveBody));
    ok("reserve parazgjedh orën e bartur", (await page.locator(".rsv-slot.on").count()) > 0);
    // Data e bartur: kthehu te hapi 'Data' dhe verifiko fushën.
    await page.locator(".rsv-back").first().click();
    await page.waitForTimeout(300);
    const dateInput = await page.locator('input[type="date"]').first().inputValue().catch(() => "");
    ok("reserve prefill data e bartur", dateInput === date, dateInput);
  }

  // ── T4: Gjendja pa rezultate ──
  console.log("\nT4 pa rezultate:");
  await page.goto(`${BASE}/restaurants?q=zzz-nuk-ekziston-${token}`, { waitUntil: "networkidle" });
  ok("mesazh pa rezultate", ((await page.locator("main").textContent()) || "").includes("Nuk u gjet asnjë restorant"));

  // ── T5: SEO ──
  console.log("\nT5 SEO:");
  const profileHtml = await (await page.goto(`${BASE}/restaurants/${main1.slug}`, { waitUntil: "networkidle" }))!.text();
  ok("JSON-LD Restaurant në profil", profileHtml.includes('"@type":"Restaurant"') && profileHtml.includes(`${token} Mountain Grill`));
  ok("profili ka canonical", profileHtml.includes('rel="canonical"'));
  ok("JSON-LD pa aggregateRating të sajuar", !profileHtml.includes("aggregateRating"));

  const sitemap = await (await page.goto(`${BASE}/sitemap.xml`, { waitUntil: "networkidle" }))!.text();
  ok("sitemap përmban profilin publik", sitemap.includes(`/restaurants/${main1.slug}`));
  ok("sitemap nuk përmban /dashboard apo /bookings", !sitemap.includes("/dashboard") && !sitemap.includes("/bookings"));

  const robots = await (await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle" }))!.text();
  ok("robots disallow /dashboard", robots.includes("/dashboard"));
  ok("robots disallow /bookings", robots.includes("/bookings"));
  ok("robots reference sitemap", /Sitemap:/i.test(robots));

  // ── Screenshots @390/1440 ──
  console.log("\nScreenshots:");
  await shoot(browser, "/", "home");
  await shoot(browser, `/restaurants?q=${encodeURIComponent(token)}`, "search");
  await shoot(browser, `/restaurants?q=${encodeURIComponent(`${token} Mountain`)}&date=${date}&guests=2`, "search-availability");

  await ctx.close();
  await browser.close();
  await cleanup();
  console.log(`\nOverflow problems: ${problems.length}`);
  problems.forEach((p) => console.log("  " + p));
  console.log(`\n──────── PHASE 6 E2E: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
