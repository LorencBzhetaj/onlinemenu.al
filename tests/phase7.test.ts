/*
 * Teste për Fazën 7 (ekipi, abonimet/modulet, audit, analitika) — kundrejt Postgres LOKAL.
 * Fokus: ftesa (skadim/ripërdorim), invarianti i OWNER, revokim, leje, aktivizim modulesh,
 * rinovim pa humbur periudhën e mbetur, audit (pa sekrete) dhe agregime analitike reale.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import {
  createInvitation, getInvitationByToken, acceptInvitation,
  revokeMembership, revokeInvitation, listTeam, INVITATION_TTL_MS,
} from "@/modules/memberships/invitations";
import { resolveAccess, AccessError } from "@/modules/memberships/access";
import { roleCan } from "@/modules/memberships/permissions";
import { setModuleStatus, listModules } from "@/modules/subscriptions/modules";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { computeRenewalExpiresAt, addDays } from "@/lib/subscription";
import { recordAudit, listAudit } from "@/modules/admin/audit";
import { recordEvent, getAnalyticsSummary, PUBLIC_EVENT_TYPES } from "@/modules/analytics/events";
import { createHash } from "crypto";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

(function guardDb() {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = url.includes("@localhost") || url.includes("@127.0.0.1");
  const looksRemote = /neon\.tech|amazonaws|supabase|\.cloud/i.test(url);
  if (process.env.ALLOW_NONLOCAL_TEST_DB === "1") return;
  if (!url || !isLocal || looksRemote) { console.error("⛔ DB LOKALE vetëm."); process.exit(2); }
})();

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

const SUF = "@test.local";
async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  const rids = rests.map((r) => r.id);
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { restaurantId: { in: rids } }] } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } }); // cascade: restorantet + analytics + invitations
}

let seq = 0;
async function makeUser(tag: string) {
  return prisma.user.create({ data: { email: `${tag}-${Date.now()}-${seq++}${SUF}`.toLowerCase(), role: "RESTAURANT_OWNER", emailVerified: true }, select: { id: true, email: true } });
}
async function makeOwnerRestaurant(tag: string) {
  const owner = await makeUser(tag);
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, owner.id, `Resto ${tag}`));
  return { ownerId: owner.id, ownerEmail: owner.email, restaurantId };
}

async function run() {
  await cleanup();
  console.log("\n▶ Faza 7 — ekipi, abonime/module, audit, analitika\n");

  // ── 1) Ftesa: krijim, role, pranim, ripërdorim, skadim ─────────────────
  const A = await makeOwnerRestaurant("teamA");
  const staff = await makeUser("staff");

  const inv = await createInvitation({ restaurantId: A.restaurantId, email: staff.email, role: "STAFF", invitedByUserId: A.ownerId, invitedByEmail: A.ownerEmail });
  ok("ftesa krijohet (STAFF)", inv.ok && !!(inv as any).token);
  const token = (inv as any).token as string;

  const bad = await createInvitation({ restaurantId: A.restaurantId, email: "x@y.z", role: "OWNER", invitedByUserId: A.ownerId });
  ok("ftesa OWNER refuzohet (invariant)", !bad.ok && (bad as any).error === "bad_role");

  const view = await getInvitationByToken(token);
  ok("getInvitationByToken kthen pending", !!view && view.status === "pending" && !view.expired);

  // Email mismatch
  const other = await makeUser("other");
  const mism = await acceptInvitation({ token, userId: other.id, userEmail: other.email });
  ok("pranim me email të gabuar → email_mismatch", !mism.ok && (mism as any).error === "email_mismatch");

  // Pranim korrekt
  const acc = await acceptInvitation({ token, userId: staff.id, userEmail: staff.email });
  ok("pranim korrekt → membership STAFF", acc.ok && (acc as any).role === "STAFF");
  const m = await prisma.restaurantMembership.findUnique({ where: { userId_restaurantId: { userId: staff.id, restaurantId: A.restaurantId } }, select: { role: true, status: true } });
  ok("membership aktiv me rol STAFF", m?.role === "STAFF" && m?.status === "active");

  // Ripërdorim → used
  const reuse = await acceptInvitation({ token, userId: staff.id, userEmail: staff.email });
  ok("ripërdorim i ftesës → used", !reuse.ok && (reuse as any).error === "used");

  // already_member
  const again = await createInvitation({ restaurantId: A.restaurantId, email: staff.email, role: "STAFF", invitedByUserId: A.ownerId });
  ok("ftesë për anëtar aktiv → already_member", !again.ok && (again as any).error === "already_member");

  // Skadim
  const u2 = await makeUser("expinv");
  const inv2 = await createInvitation({ restaurantId: A.restaurantId, email: u2.email, role: "MANAGER", invitedByUserId: A.ownerId });
  const token2 = (inv2 as any).token as string;
  await prisma.invitation.update({ where: { tokenHash: sha(token2) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const expAcc = await acceptInvitation({ token: token2, userId: u2.id, userEmail: u2.email });
  ok("ftesë e skaduar → expired", !expAcc.ok && (expAcc as any).error === "expired");

  // TTL i konfigurueshëm (7 ditë)
  ok("INVITATION_TTL_MS = 7 ditë", INVITATION_TTL_MS === 7 * 24 * 60 * 60 * 1000);

  // Pranim njëpërdorimësh konkurrent
  const u3 = await makeUser("race");
  const inv3 = await createInvitation({ restaurantId: A.restaurantId, email: u3.email, role: "STAFF", invitedByUserId: A.ownerId });
  const token3 = (inv3 as any).token as string;
  const [r1, r2] = await Promise.all([
    acceptInvitation({ token: token3, userId: u3.id, userEmail: u3.email }),
    acceptInvitation({ token: token3, userId: u3.id, userEmail: u3.email }),
  ]);
  ok("pranim konkurrent → saktësisht një fiton", (r1.ok ? 1 : 0) + (r2.ok ? 1 : 0) === 1);

  // ── 2) Revokim + invarianti i OWNER ────────────────────────────────────
  const rev = await revokeMembership({ restaurantId: A.restaurantId, targetUserId: staff.id, actorUserId: A.ownerId, actorEmail: A.ownerEmail });
  ok("revokim i STAFF → ok", rev.ok);
  try {
    await resolveAccess(staff.id, "reservations:read", A.restaurantId);
    ok("anëtar i revokuar s'ka akses", false, "u lejua");
  } catch (e) {
    ok("anëtar i revokuar s'ka akses (no_membership)", e instanceof AccessError && e.code === "no_membership");
  }
  const ownerMembership = await prisma.restaurantMembership.findFirst({ where: { restaurantId: A.restaurantId, role: "OWNER" }, select: { userId: true } });
  const revOwner = await revokeMembership({ restaurantId: A.restaurantId, targetUserId: ownerMembership!.userId, actorUserId: A.ownerId });
  ok("OWNER s'revokohet (invariant)", !revOwner.ok && (revOwner as any).error === "cannot_revoke_owner");
  const ownersLeft = await prisma.restaurantMembership.count({ where: { restaurantId: A.restaurantId, role: "OWNER", status: "active" } });
  ok("mbetet të paktën një OWNER aktiv", ownersLeft === 1);

  // Izolim tenant: revoko ftesë pending nga restorant tjetër → s'prek
  const B = await makeOwnerRestaurant("teamB");
  const invB = await createInvitation({ restaurantId: B.restaurantId, email: "z@x.al", role: "STAFF", invitedByUserId: B.ownerId });
  const okRevWrongTenant = await revokeInvitation({ restaurantId: A.restaurantId, invitationId: (invB as any).invitationId, actorUserId: A.ownerId });
  ok("revokim ftese nga tenant i gabuar → jo", okRevWrongTenant === false);

  // ── 3) Leje ────────────────────────────────────────────────────────────
  ok("team:write vetëm OWNER", roleCan("OWNER", "team:write") && !roleCan("MANAGER", "team:write") && !roleCan("STAFF", "team:write"));
  ok("team:read vetëm OWNER", roleCan("OWNER", "team:read") && !roleCan("STAFF", "team:read"));

  // ── 4) Modulet: aktivizim i ndarë + entitlement ────────────────────────
  const C = await makeOwnerRestaurant("mod");
  ok("BOOKING fillimisht joaktiv", (await hasEntitlement(C.restaurantId, "BOOKING")) === false);
  const act = await setModuleStatus({ restaurantId: C.restaurantId, module: "BOOKING", status: "active" });
  ok("setModuleStatus BOOKING active → ok", act.ok);
  ok("BOOKING tani aktiv", (await hasEntitlement(C.restaurantId, "BOOKING")) === true);
  ok("MENU mbetet aktiv (i pandryshuar)", (await hasEntitlement(C.restaurantId, "MENU")) === true);
  const dis = await setModuleStatus({ restaurantId: C.restaurantId, module: "BOOKING", status: "disabled" });
  ok("çaktivizim BOOKING → ok", dis.ok);
  ok("BOOKING sërish joaktiv", (await hasEntitlement(C.restaurantId, "BOOKING")) === false);
  ok("setModuleStatus modul i gabuar → bad_module", !(await setModuleStatus({ restaurantId: C.restaurantId, module: "X", status: "active" })).ok);
  ok("setModuleStatus status i gabuar → bad_status", !(await setModuleStatus({ restaurantId: C.restaurantId, module: "MENU", status: "weird" })).ok);
  const mods = await listModules(C.restaurantId);
  ok("listModules kthen MENU+BOOKING", mods.length === 2 && mods[0].module === "MENU" && mods[1].module === "BOOKING");

  // ── 5) Rinovim pa humbur periudhën e mbetur ────────────────────────────
  const future = addDays(new Date(), 10);
  const renewed = computeRenewalExpiresAt("monthly", future);
  ok("rinovim aktiv zgjat NGA skadimi (10+30≈40 ditë)", Math.round((renewed.getTime() - Date.now()) / 86400000) >= 39);
  const past = addDays(new Date(), -5);
  const renewedPast = computeRenewalExpiresAt("monthly", past);
  ok("rinovim i skaduari fillon NGA sot (≈30 ditë)", Math.round((renewedPast.getTime() - Date.now()) / 86400000) === 30);

  // Trial i skaduar → pa entitlement
  const D = await makeOwnerRestaurant("trial");
  await prisma.subscription.update({ where: { restaurantId: D.restaurantId }, data: { status: "trial", expiresAt: new Date(Date.now() - 86400000) } });
  ok("trial i skaduar → MENU jo-aktiv", (await hasEntitlement(D.restaurantId, "MENU")) === false);

  // ── 6) Audit (pa sekrete/token) ────────────────────────────────────────
  const auditA = await listAudit({ restaurantId: A.restaurantId, limit: 200 });
  ok("audit regjistroi team.invite", auditA.some((e) => e.action === "team.invite"));
  ok("audit regjistroi team.accept", auditA.some((e) => e.action === "team.accept"));
  ok("audit regjistroi team.revoke", auditA.some((e) => e.action === "team.revoke"));
  ok("audit NUK përmban token-in e ftesës", !auditA.some((e) => (e.summary ?? "").includes(token) || (e.summary ?? "").includes(token3)));
  await recordAudit({ actorUserId: A.ownerId, actorEmail: A.ownerEmail, actorRole: "SUPER_ADMIN", restaurantId: A.restaurantId, action: "subscription.update", targetType: "Subscription", summary: "plan=monthly" });
  ok("recordAudit shkruan një rresht", (await listAudit({ action: "subscription.update", limit: 5 })).length >= 1);

  // ── 7) Analitika reale, tenant-scoped ──────────────────────────────────
  const E = await makeOwnerRestaurant("an");
  const cat = await prisma.category.create({ data: { restaurantId: E.restaurantId, nameAl: "Pjata", nameEn: "Mains", sortOrder: 0 } });
  const dish = await prisma.menuItem.create({ data: { categoryId: cat.id, nameAl: "Tavë", nameEn: "Tave", price: 700 } });
  await recordEvent({ restaurantId: E.restaurantId, type: "profile_view" });
  await recordEvent({ restaurantId: E.restaurantId, type: "profile_view" });
  await recordEvent({ restaurantId: E.restaurantId, type: "menu_view" });
  await recordEvent({ restaurantId: E.restaurantId, type: "wolt_click", meta: "WOLT" });
  await recordEvent({ restaurantId: E.restaurantId, type: "item_view", itemId: dish.id });
  await recordEvent({ restaurantId: E.restaurantId, type: "item_view", itemId: dish.id });
  await recordEvent({ restaurantId: E.restaurantId, type: "booking_created" });
  // Event i një restoranti tjetër — s'duhet të përzihet (izolim).
  await recordEvent({ restaurantId: A.restaurantId, type: "profile_view" });

  const sum = await getAnalyticsSummary(E.restaurantId, 30);
  ok("totals profile_view=2", sum.totals.profile_view === 2);
  ok("totals menu_view=1", sum.totals.menu_view === 1);
  ok("totals wolt_click=1", sum.totals.wolt_click === 1);
  ok("totals item_view=2", sum.totals.item_view === 2);
  ok("totals booking_created=1", sum.totals.booking_created === 1);
  ok("topItems rendit pjatën me emër", sum.topItems.length === 1 && sum.topItems[0].name === "Tavë" && sum.topItems[0].count === 2);
  ok("izolim tenant (A s'përzihet me E)", sum.total === 7);
  ok("booking_created s'pranohet nga beacon publik", !PUBLIC_EVENT_TYPES.has("booking_created" as any) && PUBLIC_EVENT_TYPES.has("profile_view" as any));

  await cleanup();
  console.log(`\n── Faza 7: ${pass} ✅  ${fail} ❌ ──\n`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
