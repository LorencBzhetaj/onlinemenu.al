/*
 * Teste integrimi për Fazën 1 (tenant isolation, role, entitlement, provisionim,
 * restorant aktiv) — kundrejt Postgres LOKAL testimi. Shih tests/README.md.
 * Guard-i i DB-së (pretest + guardi këtu) parandalon prekjen e prodhimit.
 */
import { prisma } from "@/lib/prisma";
import { resolveAccess, AccessError } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { selectActiveRestaurant } from "@/modules/memberships/active-restaurant";
import { createPendingRegistration, consumeVerification } from "@/lib/email-verification";
import type { Role } from "@/modules/memberships/permissions";

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
async function expectAccess(p: Promise<unknown>, expected: string): Promise<boolean> {
  try { await p; return expected === "ok"; }
  catch (e) { return e instanceof AccessError && e.code === expected; }
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
  const { restaurantId } = await provision(user.id, name);
  return { userId: user.id, restaurantId };
}
async function makeUser(tag: string) {
  return (await prisma.user.create({
    data: { email: `${tag}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true },
    select: { id: true },
  })).id;
}
async function addMembership(userId: string, restaurantId: string, role: Role, status = "active") {
  await prisma.restaurantMembership.upsert({
    where: { userId_restaurantId: { userId, restaurantId } },
    update: { role, status },
    create: { userId, restaurantId, role, status },
  });
}

async function main() {
  await cleanup();

  const A = await makeOwner("p-ownerA", "Resto A");
  const B = await makeOwner("p-ownerB", "Resto B");

  // ── P1: Izolim lexim+shkrim cross-tenant ──
  console.log("\nP1 cross-tenant read+write refused:");
  {
    ok("A s'lexon menu të B (menu:read)", await expectAccess(resolveAccess(A.userId, "menu:read", B.restaurantId), "no_membership"));
    ok("A s'shkruan menu të B (menu:write)", await expectAccess(resolveAccess(A.userId, "menu:write", B.restaurantId), "no_membership"));
    ok("A lexon menunë e vet", await expectAccess(resolveAccess(A.userId, "menu:read", A.restaurantId), "ok"));
  }

  // ── P2: Membership i revokuar → lexime private refuzohen ──
  console.log("\nP2 revoked membership (reads refused):");
  {
    const mgr = await makeUser("p-mgrRevoked");
    await addMembership(mgr, A.restaurantId, "MANAGER", "revoked");
    ok("revoked → menu:read refuzohet", await expectAccess(resolveAccess(mgr, "menu:read", A.restaurantId), "no_membership"));
    ok("revoked → billing:read refuzohet", await expectAccess(resolveAccess(mgr, "billing:read", A.restaurantId), "no_membership"));
    await addMembership(mgr, A.restaurantId, "MANAGER", "active");
    ok("i riaktivizuar → menu:read lejohet", await expectAccess(resolveAccess(mgr, "menu:read", A.restaurantId), "ok"));
  }

  // ── P3: Rol → veprim ──
  console.log("\nP3 role → action:");
  {
    const staff = await makeUser("p-staff");
    const mgr = await makeUser("p-mgr");
    await addMembership(staff, A.restaurantId, "STAFF");
    await addMembership(mgr, A.restaurantId, "MANAGER");
    // STAFF
    ok("STAFF menu:read ok", await expectAccess(resolveAccess(staff, "menu:read", A.restaurantId), "ok"));
    ok("STAFF menu:write forbidden", await expectAccess(resolveAccess(staff, "menu:write", A.restaurantId), "forbidden"));
    ok("STAFF billing:read forbidden", await expectAccess(resolveAccess(staff, "billing:read", A.restaurantId), "forbidden"));
    ok("STAFF settings:read forbidden", await expectAccess(resolveAccess(staff, "settings:read", A.restaurantId), "forbidden"));
    ok("STAFF team:read forbidden", await expectAccess(resolveAccess(staff, "team:read", A.restaurantId), "forbidden"));
    // MANAGER
    ok("MANAGER menu:write ok", await expectAccess(resolveAccess(mgr, "menu:write", A.restaurantId), "ok"));
    ok("MANAGER branding:write ok", await expectAccess(resolveAccess(mgr, "branding:write", A.restaurantId), "ok"));
    ok("MANAGER billing:read forbidden", await expectAccess(resolveAccess(mgr, "billing:read", A.restaurantId), "forbidden"));
    ok("MANAGER team:write forbidden", await expectAccess(resolveAccess(mgr, "team:write", A.restaurantId), "forbidden"));
    // OWNER
    ok("OWNER billing:read ok", await expectAccess(resolveAccess(A.userId, "billing:read", A.restaurantId), "ok"));
    ok("OWNER team:write ok", await expectAccess(resolveAccess(A.userId, "team:write", A.restaurantId), "ok"));
  }

  // ── P4: Veprim i panjohur dhe restaurantId i munguar ──
  console.log("\nP4 unknown action / missing id:");
  {
    ok("action i panjohur → forbidden", await expectAccess(resolveAccess(A.userId, "frobnicate", A.restaurantId), "forbidden"));
    ok("restaurantId null → bad_request", await expectAccess(resolveAccess(A.userId, "menu:read", null), "bad_request"));
  }

  // ── P5: hasEntitlement — tabela e vendimeve ──
  console.log("\nP5 hasEntitlement decision table:");
  {
    const E = await makeOwner("p-ent", "Resto Ent");
    const rid = E.restaurantId;
    const sub = (await prisma.subscription.findUnique({ where: { restaurantId: rid }, select: { id: true } }))!;
    const setSub = (data: any) => prisma.subscription.update({ where: { id: sub.id }, data });
    const setMenu = (data: any) => prisma.moduleEntitlement.update({ where: { subscriptionId_module: { subscriptionId: sub.id, module: "MENU" } }, data });
    const setSuspend = (v: Date | null) => prisma.restaurant.update({ where: { id: rid }, data: { suspendedAt: v } });

    ok("default: MENU true", (await hasEntitlement(rid, "MENU")) === true);
    ok("default: BOOKING false (disabled)", (await hasEntitlement(rid, "BOOKING")) === false);
    await setSuspend(new Date());
    ok("suspended → MENU false", (await hasEntitlement(rid, "MENU")) === false);
    await setSuspend(null);
    await setSub({ status: "cancelled" });
    ok("subscription cancelled → false", (await hasEntitlement(rid, "MENU")) === false);
    await setSub({ status: "weird-unknown" });
    ok("subscription status i panjohur → false (allowlist)", (await hasEntitlement(rid, "MENU")) === false);
    await setSub({ status: "active" });
    ok("subscription active → MENU true", (await hasEntitlement(rid, "MENU")) === true);
    await setMenu({ status: "disabled" });
    ok("module disabled → false", (await hasEntitlement(rid, "MENU")) === false);
    await setMenu({ status: "active", expiresAt: new Date(Date.now() - 1000) });
    ok("module expiresAt <= now → false", (await hasEntitlement(rid, "MENU")) === false);
    await setMenu({ expiresAt: new Date(Date.now() + 60_000) });
    ok("module expiresAt në të ardhmen → true", (await hasEntitlement(rid, "MENU")) === true);
    await setMenu({ expiresAt: null });
    await setSub({ expiresAt: new Date(Date.now() - 1000) });
    ok("subscription expiresAt <= now → false", (await hasEntitlement(rid, "MENU")) === false);
    ok("restorant inekzistent → false", (await hasEntitlement("nuk-ekziston", "MENU")) === false);
  }

  // ── P6: Backfill me subscription të anuluar NUK riaktivizon ──
  console.log("\nP6 cancelled-subscription backfill:");
  {
    const C = await makeOwner("p-cancel", "Resto Cancel");
    const sub = (await prisma.subscription.findUnique({ where: { restaurantId: C.restaurantId }, select: { id: true } }))!;
    // Simulim gjendjeje legacy: fshi entitlement-et, vendos subscription cancelled.
    await prisma.moduleEntitlement.deleteMany({ where: { subscriptionId: sub.id } });
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancelled" } });
    // Backfill-i i migrimit (MENU):
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ModuleEntitlement" ("id","subscriptionId","module","status","expiresAt")
       SELECT md5(random()::text || s.id || 'menu'), s.id, 'MENU',
         CASE WHEN s.status IN ('trial','active') THEN 'active' ELSE 'expired' END, NULL
       FROM "Subscription" s WHERE s.id = $1
       ON CONFLICT ("subscriptionId","module") DO NOTHING`,
      sub.id
    );
    const ent = await prisma.moduleEntitlement.findUnique({ where: { subscriptionId_module: { subscriptionId: sub.id, module: "MENU" } }, select: { status: true } });
    ok("MENU entitlement status != 'active' (expired)", ent?.status === "expired", `=${ent?.status}`);
    ok("hasEntitlement(MENU) false (s'riaktivizohet)", (await hasEntitlement(C.restaurantId, "MENU")) === false);
  }

  // ── P7: createRestaurantForOwner — atomik, idempotent, concurrency, kthen id ──
  console.log("\nP7 createRestaurantForOwner:");
  {
    const u = await makeUser("p-prov");
    const a = await provision(u, "Prov One");
    ok("kthen restaurantId", !!a.restaurantId && a.created === true);
    const r = await prisma.restaurant.findUnique({
      where: { id: a.restaurantId },
      select: { ownerId: true, subscription: { select: { status: true, entitlements: { select: { module: true, status: true } } } }, memberships: { select: { userId: true, role: true, status: true } } },
    });
    ok("subscription trial", r?.subscription?.status === "trial");
    const ents = r?.subscription?.entitlements ?? [];
    ok("MENU active + BOOKING disabled", ents.find((e) => e.module === "MENU")?.status === "active" && ents.find((e) => e.module === "BOOKING")?.status === "disabled");
    ok("OWNER membership = pronari", r?.memberships.length === 1 && r?.memberships[0].role === "OWNER" && r?.memberships[0].userId === u);
    const b = await provision(u, "Prov One");
    ok("idempotent: created=false, njëjti id", b.created === false && b.restaurantId === a.restaurantId);

    // Concurrency: dy provisione paralele për një pronar të ri → 1 restorant.
    const u2 = await makeUser("p-prov2");
    const [c1, c2] = await Promise.all([provision(u2, "Race"), provision(u2, "Race")]);
    ok("concurrency: njëjti restaurantId", c1.restaurantId === c2.restaurantId);
    ok("concurrency: saktësisht 1 restaurant", (await prisma.restaurant.count({ where: { ownerId: u2 } })) === 1);
    ok("concurrency: saktësisht 1 OWNER membership", (await prisma.restaurantMembership.count({ where: { restaurantId: c1.restaurantId, role: "OWNER" } })) === 1);
  }

  // ── P8: Invariant ownerId ↔ OWNER membership (nga ndërtimi) ──
  console.log("\nP8 ownerId ↔ OWNER invariant:");
  {
    const owners = await prisma.restaurant.findMany({
      where: { ownerId: { in: [A.userId, B.userId] } },
      select: { ownerId: true, memberships: { where: { role: "OWNER" }, select: { userId: true } } },
    });
    ok("çdo restorant ka OWNER = ownerId", owners.every((r) => r.memberships.length === 1 && r.memberships[0].userId === r.ownerId));
  }

  // ── P9: selectActiveRestaurant ──
  console.log("\nP9 selectActiveRestaurant:");
  {
    const u = A.userId;
    await addMembership(u, B.restaurantId, "MANAGER"); // tani A është anëtar i B-së gjithashtu
    await selectActiveRestaurant(u, B.restaurantId);
    ok("aktivi u vendos te B", (await prisma.user.findUnique({ where: { id: u }, select: { activeRestaurantId: true } }))?.activeRestaurantId === B.restaurantId);
    const C = await makeOwner("p-cForActive", "Resto C");
    let threw = false;
    try { await selectActiveRestaurant(u, C.restaurantId); } catch (e) { threw = e instanceof AccessError; }
    ok("s'zgjedh dot një ku s'është anëtar", threw);
    ok("aktivi mbeti i pandryshuar (B)", (await prisma.user.findUnique({ where: { id: u }, select: { activeRestaurantId: true } }))?.activeRestaurantId === B.restaurantId);
    // rikthe A te restoranti i vet për pastërti
    await selectActiveRestaurant(u, A.restaurantId);
    await prisma.restaurantMembership.deleteMany({ where: { userId: u, restaurantId: B.restaurantId } });
  }

  // ── P10: Krijim user/restorant pas verifikimit → membership + entitlements ──
  console.log("\nP10 creation after verification:");
  {
    const email = `p-verify${SUF}`;
    const reg = await createPendingRegistration(email, "password-123", "Verifikuar Resto");
    ok("regjistrim ok", reg.status === "ok");
    if (reg.status === "ok") {
      const r = await consumeVerification({ token: reg.token });
      ok("verifikim ok", r.status === "ok");
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      const rest = await prisma.restaurant.findFirst({
        where: { ownerId: user!.id },
        select: { id: true, memberships: { select: { role: true, userId: true } }, subscription: { select: { entitlements: { select: { module: true, status: true } } } } },
      });
      ok("OWNER membership u krijua", rest?.memberships.some((m) => m.role === "OWNER" && m.userId === user!.id) === true);
      ok("MENU entitlement active", rest?.subscription?.entitlements.find((e) => e.module === "MENU")?.status === "active");
      ok("hasEntitlement(MENU) true", (await hasEntitlement(rest!.id, "MENU")) === true);
    }
  }

  await cleanup();
  console.log(`\n──────── PHASE 1 RESULT: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await prisma.$disconnect();
  process.exit(1);
});
