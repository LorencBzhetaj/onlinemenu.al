/*
 * Teste për Fazën 9 (katalogu i menuve dhe kërkimi sipas emrit) — kundrejt Postgres LOKAL.
 * Mbulon: normalizimin ë/e ç/c, renditjen (fillimi i emrit → fjalë → diku), kufizimin te qyteti,
 * portën MENU të katalogut (ekuivalente me hasEntitlement), sugjerimet dhe kthimin e sigurt.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { searchRestaurants, parseSearchParams, suggestRestaurants, SUGGEST_MAX } from "@/modules/restaurants/search";
import { hasEntitlement, entitlementWhere } from "@/modules/subscriptions/entitlements";
import { normalizeForSearch, nameMatchRank } from "@/lib/text-normalize";
import { safeReturnPath, menuHref } from "@/lib/safe-return";
import { cuisineIconSrc, CUISINE_ICON_FALLBACK } from "@/lib/cuisine-icons";

(function guardDb() {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = url.includes("@localhost") || url.includes("@127.0.0.1");
  if (process.env.ALLOW_NONLOCAL_TEST_DB === "1") return;
  if (!url || !isLocal || /neon\.tech|amazonaws|supabase|\.cloud/i.test(url)) {
    console.error("⛔ REFUZOHET: testet ekzekutohen vetëm kundrejt një DB LOKALE testimi.");
    process.exit(2);
  }
})();

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

const SUF = "@phase9.test";
const TAG = "zq9"; // prefiks unik që izolon kërkimet e testit

async function mk(name: string, city: string | null, opts: { publish?: boolean } = {}) {
  const u = await prisma.user.create({ data: { email: `${Math.random().toString(36).slice(2)}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true } });
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, u.id, name));
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { isPublished: opts.publish ?? true, city } });
  return restaurantId;
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
}

async function main() {
  await cleanup();

  console.log("1. Normalizimi dhe renditja (pa DB):");
  ok("ë→e, ç→c, pa dallim shkronjash", normalizeForSearch("  ÇAJTORE  Shtëpia ") === "cajtore shtepia");
  ok("fillimi i emrit = 0", nameMatchRank("Bora", "bo") === 0);
  ok("fillimi i një fjale = 1", nameMatchRank("Bistro Bota", "bo") === 1);
  ok("diku në emër = 2", nameMatchRank("Kebabo", "bo") === 2);
  ok("pa përputhje = null", nameMatchRank("Pica", "bo") === null);

  console.log("\n2. Kthimi i sigurt (from):");
  ok("katalog me kërkim + qytet", safeReturnPath("/restaurants?q=bo&city=Tiran%C3%AB&date=2026-01-01") === "/restaurants?q=bo&city=Tiran%C3%AB");
  ok("kryefaqja", safeReturnPath("/") === "/");
  ok("profili", safeReturnPath("/restaurants/te-gurra") === "/restaurants/te-gurra");
  ok("refuzohet URL e jashtme", safeReturnPath("https://evil.example/x") === null);
  ok("refuzohet //host", safeReturnPath("//evil.example") === null);
  ok("refuzohet backslash", safeReturnPath("/\\evil.example") === null);
  ok("refuzohet rrugë jashtë allowlist", safeReturnPath("/dashboard") === null);
  ok("refuzohet javascript:", safeReturnPath("javascript:alert(1)") === null);
  ok("menuHref kodon from", menuHref("a-b", "/restaurants?q=bo") === "/restaurants/a-b/menu?from=%2Frestaurants%3Fq%3Dbo");

  console.log("\n3. Kërkimi në katalog:");
  const bora = await mk(`${TAG}Bora`, "Tiranë");
  const bota = await mk(`Bistro ${TAG}Bota`, "Durrës");
  const shtepia = await mk(`${TAG} Shtëpia e Çajit`, "Tiranë");
  const hidden = await mk(`${TAG}Bodrum`, "Tiranë", { publish: false });
  const noMenu = await mk(`${TAG}Borek`, "Tiranë");
  await prisma.moduleEntitlement.updateMany({ where: { module: "MENU", subscription: { restaurantId: noMenu } }, data: { status: "disabled" } });

  const r1 = await searchRestaurants(parseSearchParams({ q: `${TAG}bo` }));
  const names1 = r1.items.map((i) => i.name);
  ok("'bo' gjen Bora dhe Bistro Bota", names1.includes(`${TAG}Bora`) && names1.includes(`Bistro ${TAG}Bota`), JSON.stringify(names1));
  ok("fillimi i emrit renditet para përputhjes në mes", names1.indexOf(`${TAG}Bora`) < names1.indexOf(`Bistro ${TAG}Bota`), JSON.stringify(names1));
  ok("i papublikuar s'shfaqet", !names1.includes(`${TAG}Bodrum`));
  ok("pa MENU aktiv s'shfaqet në katalog", !names1.includes(`${TAG}Borek`));
  const r2 = await searchRestaurants(parseSearchParams({ q: `${TAG.toUpperCase()}BO` }));
  ok("pa dallim shkronjash", r2.items.length === r1.items.length);
  const r3 = await searchRestaurants(parseSearchParams({ q: `${TAG} shtepia e cajit` }));
  ok("ë/e dhe ç/c përputhen", r3.items.some((i) => i.name === `${TAG} Shtëpia e Çajit`));
  const r4 = await searchRestaurants(parseSearchParams({ q: `${TAG}bo`, city: "Durrës" }));
  ok("me qytet: vetëm ai qytet", r4.items.length === 1 && r4.items[0].name === `Bistro ${TAG}Bota`, JSON.stringify(r4.items.map((i) => i.name)));
  const r5 = await searchRestaurants(parseSearchParams({ q: `${TAG}xyz` }));
  ok("pa rezultat → 0", r5.total === 0 && r5.items.length === 0);

  console.log("\n4. Porta MENU (entitlementWhere ≡ hasEntitlement):");
  const expiredSub = await mk(`${TAG}SkaduarAbonim`, "Tiranë");
  await prisma.subscription.update({ where: { restaurantId: expiredSub }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const expiredMod = await mk(`${TAG}SkaduarModul`, "Tiranë");
  await prisma.moduleEntitlement.updateMany({ where: { module: "MENU", subscription: { restaurantId: expiredMod } }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const suspended = await mk(`${TAG}Pezulluar`, "Tiranë");
  await prisma.restaurant.update({ where: { id: suspended }, data: { suspendedAt: new Date() } });
  for (const [label, id] of [["aktiv", bora], ["MENU disabled", noMenu], ["abonim i skaduar", expiredSub], ["modul i skaduar", expiredMod], ["pezulluar", suspended]] as const) {
    const viaFn = await hasEntitlement(id, "MENU");
    const viaWhere = (await prisma.restaurant.count({ where: { id, ...entitlementWhere("MENU") } })) === 1;
    ok(`${label}: hasEntitlement=${viaFn} == filtri=${viaWhere}`, viaFn === viaWhere);
  }

  console.log("\n5. Sugjerimet:");
  ok("< 2 karaktere → []", (await suggestRestaurants("b", null)).length === 0);
  const s1 = await suggestRestaurants(`${TAG}bo`, null);
  ok("renditje: Bora e para", s1[0]?.name === `${TAG}Bora`, JSON.stringify(s1.map((s) => s.name)));
  ok("vetëm fusha publike", s1.every((s) => Object.keys(s).sort().join() === "city,cuisine,name,slug"));
  ok("me qytet", (await suggestRestaurants(`${TAG}bo`, "Durrës")).every((s) => s.city === "Durrës"));
  ok(`maksimumi ${SUGGEST_MAX}`, s1.length <= SUGGEST_MAX);
  void shtepia;
  void hidden;

  console.log("\n6. Ikonat e kuzhinave (emër i normalizuar → ikonë):");
  const expect: [string, string][] = [
    ["Tradicionale", "tradicionale"], ["Peshku", "peshku"], ["Pica", "pizza"], ["Pizzeria", "pizza"],
    ["Burger House", "burgers"], ["Sufllaqe", "sufllaqe"], ["SUFLLAQE & Gyros", "sufllaqe"], ["Fast Food", "fast-food"],
    ["Ëmbëlsira", "embelsira"], ["embelsira", "embelsira"], ["Kafe", "kafe"], ["Zgarë", "zgare"],
    ["Mëngjes", "mengjes"], ["Pasta", "pasta"], ["Vegjetariane", "vegan"],
  ];
  for (const [c, k] of expect) ok(`${c} → ${k}`, cuisineIconSrc(c) === `/brand/kategorite/${k}.webp`, cuisineIconSrc(c));
  ok("e panjohur → ikona rezervë", cuisineIconSrc("Japoneze") === CUISINE_ICON_FALLBACK);

  await cleanup();
  console.log(`\n──────── FAZA 9: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
