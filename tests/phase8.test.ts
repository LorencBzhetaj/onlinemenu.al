/*
 * Teste për Fazën 8 (release readiness) — kundrejt Postgres LOKAL.
 * Fokus: ATOMICITETI i AuditLog-ut me mutacionin kritik. Provon të dyja drejtimet:
 *   (a) dështimi i audit-it brenda transaksionit → veprimi RRËZOHET (kurrë veprim pa gjurmë);
 *   (b) dështimi i veprimit pas audit-it → audit-i RRËZOHET (kurrë gjurmë pa veprim);
 * plus rrugët pozitive: ftesë/revokim i vërtetë shkruan veprim+audit SË BASHKU.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { recordAuditTx } from "@/modules/admin/audit";
import {
  createInvitation, acceptInvitation, revokeMembership,
} from "@/modules/memberships/invitations";

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

const SUF = "@p8test.local";
let seq = 0;

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  const rids = rests.map((r) => r.id);
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { restaurantId: { in: rids } }] } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}

async function makeUser(tag: string) {
  return prisma.user.create({ data: { email: `${tag}-${Date.now()}-${seq++}${SUF}`.toLowerCase(), role: "RESTAURANT_OWNER", emailVerified: true }, select: { id: true, email: true } });
}
async function makeOwnerRestaurant(tag: string) {
  const owner = await makeUser(tag);
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, owner.id, `Resto ${tag}`));
  return { ownerId: owner.id, ownerEmail: owner.email, restaurantId };
}

async function rejects(p: Promise<unknown>): Promise<boolean> {
  try { await p; return false; } catch { return true; }
}

async function run() {
  await cleanup();
  console.log("\n▶ Faza 8 — atomiciteti i AuditLog me mutacionin kritik\n");

  // ── Setup: një restorant me OWNER + një anëtar MANAGER (për të provuar revokimin) ──
  const { ownerId, restaurantId } = await makeOwnerRestaurant("p8");
  const manager = await makeUser("mgr");
  await prisma.restaurantMembership.create({ data: { userId: manager.id, restaurantId, role: "MANAGER", status: "active" } });

  // ─────────────────────────────────────────────────────────────
  // (a) DËSHTIMI I AUDIT-IT RRËZON VEPRIMIN
  //     Brenda një transaksioni: ndryshojmë rolin MANAGER→STAFF, pastaj shkruajmë një
  //     audit me `action=null` (shkel NOT NULL) → gjithë transaksioni rrëzohet.
  // ─────────────────────────────────────────────────────────────
  console.log("(a) dështimi i audit-it rrëzon veprimin:");
  const threw = await rejects(
    prisma.$transaction(async (tx) => {
      await tx.restaurantMembership.update({
        where: { userId_restaurantId: { userId: manager.id, restaurantId } },
        data: { role: "STAFF" },
      });
      // action është NOT NULL → `create` hedh gabim → rollback i gjithë tx-it.
      await recordAuditTx(tx, { action: null as unknown as string, restaurantId, summary: "duhet të dështojë" });
    })
  );
  ok("transaksioni u rrëzua kur audit-i dështoi", threw);
  const roleAfter = await prisma.restaurantMembership.findUnique({
    where: { userId_restaurantId: { userId: manager.id, restaurantId } },
    select: { role: true },
  });
  ok("veprimi u kthye prapa (roli mbeti MANAGER)", roleAfter?.role === "MANAGER", `role=${roleAfter?.role}`);
  const orphanAudit = await prisma.auditLog.count({ where: { restaurantId, summary: "duhet të dështojë" } });
  ok("asnjë rresht audit nuk mbeti nga tx-i i dështuar", orphanAudit === 0, `count=${orphanAudit}`);

  // ─────────────────────────────────────────────────────────────
  // (b) DËSHTIMI I VEPRIMIT RRËZON AUDIT-IN
  //     Brenda një transaksioni: shkruajmë audit-in i pari (vlefshëm), pastaj veprimi dështon
  //     (hedhim gabim pas audit-it) → audit-i nuk mbetet jetim.
  // ─────────────────────────────────────────────────────────────
  console.log("\n(b) dështimi i veprimit rrëzon audit-in:");
  const uniqueMark = `p8-orphan-${Date.now()}`;
  const threw2 = await rejects(
    prisma.$transaction(async (tx) => {
      await recordAuditTx(tx, { action: "p8.test.action", restaurantId, summary: uniqueMark });
      throw new Error("veprimi dështoi pas audit-it");
    })
  );
  ok("transaksioni u rrëzua kur veprimi dështoi", threw2);
  const orphanAudit2 = await prisma.auditLog.count({ where: { restaurantId, summary: uniqueMark } });
  ok("audit-i u kthye prapa bashkë me veprimin (asnjë jetim)", orphanAudit2 === 0, `count=${orphanAudit2}`);

  // ─────────────────────────────────────────────────────────────
  // (c) RRUGË POZITIVE: ftesa reale shkruan ftesën + audit SË BASHKU
  // ─────────────────────────────────────────────────────────────
  console.log("\n(c) rrugë pozitive — ftesë reale: veprim + audit së bashku:");
  const inv = await createInvitation({ restaurantId, email: `newstaff${SUF}`, role: "STAFF", invitedByUserId: ownerId });
  ok("ftesa u krijua", inv.ok === true);
  if (inv.ok) {
    const invRow = await prisma.invitation.findUnique({ where: { id: inv.invitationId }, select: { id: true } });
    ok("rreshti i ftesës ekziston në DB", !!invRow);
    const auditRow = await prisma.auditLog.count({ where: { restaurantId, action: "team.invite", targetId: inv.invitationId } });
    ok("audit team.invite u shkrua atomikisht me ftesën", auditRow === 1, `count=${auditRow}`);
  }

  // ─────────────────────────────────────────────────────────────
  // (d) RRUGË POZITIVE: pranimi real → membership + audit; revokimi → revoked + audit
  // ─────────────────────────────────────────────────────────────
  console.log("\n(d) rrugë pozitive — pranim + revokim: membership + audit së bashku:");
  const staffUser = await makeUser("newstaff");
  // email-i i ftesës duhet të përputhet: krijojmë user me të njëjtin email si ftesa (c).
  const invStaff = await createInvitation({ restaurantId, email: staffUser.email, role: "STAFF", invitedByUserId: ownerId });
  if (invStaff.ok) {
    const acc = await acceptInvitation({ token: invStaff.token, userId: staffUser.id, userEmail: staffUser.email });
    ok("pranimi u krye", acc.ok === true);
    const mem = await prisma.restaurantMembership.findUnique({ where: { userId_restaurantId: { userId: staffUser.id, restaurantId } }, select: { status: true, role: true } });
    ok("membership STAFF aktiv u krijua", mem?.role === "STAFF" && mem?.status === "active");
    const accAudit = await prisma.auditLog.count({ where: { restaurantId, action: "team.accept", targetId: staffUser.id } });
    ok("audit team.accept u shkrua atomikisht me pranimin", accAudit === 1, `count=${accAudit}`);

    const rev = await revokeMembership({ restaurantId, targetUserId: staffUser.id, actorUserId: ownerId });
    ok("revokimi u krye", rev.ok === true);
    const memRev = await prisma.restaurantMembership.findUnique({ where: { userId_restaurantId: { userId: staffUser.id, restaurantId } }, select: { status: true } });
    ok("membership u kthye në revoked", memRev?.status === "revoked");
    const revAudit = await prisma.auditLog.count({ where: { restaurantId, action: "team.revoke", targetId: staffUser.id } });
    ok("audit team.revoke u shkrua atomikisht me revokimin", revAudit === 1, `count=${revAudit}`);
  }

  await cleanup();
  console.log(`\n──────── PHASE 8: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
