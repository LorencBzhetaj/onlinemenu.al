/*
 * Teste për Fazën 5 (njoftime) — kundrejt Postgres LOKAL. Mbulon: job në transaksionin
 * e rezervimit, dërgim pas commit-it me worker, retry/backoff→Dead, dedupe, lease/
 * konkurrencë, email failure s'anulon booking, cancel/reschedule jobs, digest idempotent.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { updateBookingSettings, setOpeningHours, createArea, createTable, purgeRestaurantBookingData } from "@/modules/booking/config";
import { createReservation, cancelReservationByToken, rescheduleReservation } from "@/modules/booking/reservations";
import { runNotificationWorker, generateDailyDigest, type NotifySender } from "@/modules/booking/notifications";
import { zonedTimeToUtc, toBusinessDateKey, businessDateAtMinutes } from "@/modules/booking/timezone";

(function guardDb() {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = url.includes("@localhost") || url.includes("@127.0.0.1");
  if (process.env.ALLOW_NONLOCAL_TEST_DB !== "1" && (!url || !isLocal || /neon\.tech|amazonaws|supabase/i.test(url))) {
    console.error("⛔ REFUZOHET: vetëm DB LOKALE testimi."); process.exit(2);
  }
})();

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}
const SUF = "@test.local";
const TZ = "Europe/Tirane";
async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: users.map((u) => u.id) } }, select: { id: true } });
  for (const r of rests) await purgeRestaurantBookingData(r.id);
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}
function futureDateKey(off: number) { return toBusinessDateKey(new Date(Date.now() + off * 86400000), TZ); }
function at(dk: string, hh: number, mm = 0) { const [y, m, d] = dk.split("-").map(Number); return zonedTimeToUtc(y, m, d, hh, mm, 0, TZ).toISOString(); }

async function makeResto(tag: string) {
  const user = await prisma.user.create({ data: { email: `${tag}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true }, select: { id: true } });
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, user.id, `Resto ${tag}`));
  const sub = await prisma.subscription.findUnique({ where: { restaurantId }, select: { id: true } });
  await prisma.moduleEntitlement.update({ where: { subscriptionId_module: { subscriptionId: sub!.id, module: "BOOKING" } }, data: { status: "active" } });
  await updateBookingSettings(restaurantId, {});
  await setOpeningHours(restaurantId, [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "12:00", endTime: "23:00" })));
  const area = await createArea(restaurantId, { name: "Brenda", kind: "indoor" });
  await createTable(restaurantId, { name: "T1", seats: 4, areaId: area.id });
  await createTable(restaurantId, { name: "T2", seats: 4, areaId: area.id });
  return { userId: user.id, restaurantId, ownerEmail: `${tag}${SUF}` };
}

const guest = (email: string) => ({ firstName: "Mysafir", lastName: "Test", phone: `+35569${Math.floor(Math.random() * 10000000)}`, email });

async function main() {
  await cleanup();
  const D = futureDateKey(3);

  // ── 1) Job në transaksionin e rezervimit ──
  console.log("\n1. Job-i krijohet me rezervimin:");
  const R = await makeResto("p5a");
  const book = await createReservation({ restaurantId: R.restaurantId, start: at(D, 19), partySize: 2, ...guest("guest@p5.local") });
  ok("rezervim ok", book.ok, JSON.stringify(book));
  const rid = book.ok ? book.data!.reservationId : "";
  const confJobs = await prisma.notificationJob.findMany({ where: { reservationId: rid } });
  ok("job konfirmimi (mysafir) ekziston Pending", confJobs.some((j) => j.dedupeKey === `conf:g:${rid}` && j.status === "Pending"));
  // Faza 10: biznesi njoftohet me BusinessNewBooking (pa marrës të konfiguruar → email-i i pronarit).
  ok("job njoftimi për biznesin (pronar, fallback) ekziston", confJobs.some((j) => j.type === "BusinessNewBooking" && j.dedupeKey === `biz:new:${rid}:Email:owner`));
  ok("job kujtese 24h ekziston me scheduledAt në të ardhmen", confJobs.some((j) => j.type === "Reminder24h" && j.scheduledAt.getTime() > Date.now()));

  // ── 2) Worker dërgon (sink) pas commit-it ──
  console.log("\n2. Worker + sink:");
  let sent: string[] = [];
  const okSender: NotifySender = async (m) => { sent.push(m.to); return { delivered: true }; };
  const res2 = await runNotificationWorker({ restaurantId: R.restaurantId, send: okSender });
  ok("worker dërgoi konfirmimet (jo kujtesën e ardhshme)", res2.sent === 2, JSON.stringify(res2));
  const confG = await prisma.notificationJob.findFirst({ where: { dedupeKey: `conf:g:${rid}` } });
  ok("job-i u bë Sent", confG?.status === "Sent");
  ok("delivery u regjistrua", (await prisma.notificationDelivery.count({ where: { jobId: confG!.id } })) >= 1);
  ok("re-run nuk ridërgon (Sent)", (await runNotificationWorker({ restaurantId: R.restaurantId, send: okSender })).sent === 0);

  // ── 3) Dedupe ──
  console.log("\n3. Dedupe:");
  // Krijim dy herë me të njëjtin idempotencyKey → një rezervim → jobs pa dublim.
  const Rd = await makeResto("p5d");
  const dk = "dedupe-key";
  const g = guest("d@p5.local");
  await createReservation({ restaurantId: Rd.restaurantId, start: at(D, 19), partySize: 2, idempotencyKey: dk, ...g });
  await createReservation({ restaurantId: Rd.restaurantId, start: at(D, 19), partySize: 2, idempotencyKey: dk, ...g });
  const dres = await prisma.reservation.findFirst({ where: { restaurantId: Rd.restaurantId, idempotencyKey: dk }, select: { id: true } });
  ok("një rezervim (idempotent)", (await prisma.reservation.count({ where: { restaurantId: Rd.restaurantId } })) === 1);
  ok("një job konfirmimi mysafiri (dedupe)", (await prisma.notificationJob.count({ where: { dedupeKey: `conf:g:${dres!.id}` } })) === 1);

  // ── 4) Retry/backoff → Dead ──
  console.log("\n4. Retry → Dead:");
  const Rf = await makeResto("p5f");
  const bf = await createReservation({ restaurantId: Rf.restaurantId, start: at(D, 19), partySize: 2, ...guest("fail@p5.local") });
  const fid = bf.ok ? bf.data!.reservationId : "";
  // maxAttempts=2 për të arritur Dead shpejt.
  await prisma.notificationJob.updateMany({ where: { reservationId: fid, type: "BookingConfirmation" }, data: { maxAttempts: 2 } });
  const failSender: NotifySender = async () => ({ delivered: false, error: "smtp_down" });
  const f1 = await runNotificationWorker({ restaurantId: Rf.restaurantId, send: failSender });
  ok("tentativa 1 → Failed (jo Dead)", f1.failed >= 1 && f1.dead === 0, JSON.stringify(f1));
  const jobAfter1 = await prisma.notificationJob.findFirst({ where: { dedupeKey: `conf:g:${fid}` } });
  ok("scheduledAt u shty (backoff)", (jobAfter1?.scheduledAt.getTime() ?? 0) > Date.now());
  ok("attempts incremented", (jobAfter1?.attempts ?? 0) === 1);
  // Avanco kohën past backoff → tentativa 2 → Dead.
  const future = new Date(Date.now() + 10 * 60_000);
  const f2 = await runNotificationWorker({ restaurantId: Rf.restaurantId, send: failSender, now: future });
  ok("tentativa 2 → Dead", f2.dead >= 1, JSON.stringify(f2));
  ok("rezervimi mbetet Confirmed (email failure s'anulon booking)", (await prisma.reservation.findUnique({ where: { id: fid }, select: { status: true } }))?.status === "Confirmed");

  // ── 5) Lease / konkurrencë ──
  console.log("\n5. Lease/konkurrencë:");
  const Rl = await makeResto("p5l");
  await createReservation({ restaurantId: Rl.restaurantId, start: at(D, 19), partySize: 2, ...guest("lease@p5.local") });
  let calls = 0;
  const countSender: NotifySender = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return { delivered: true }; };
  const [w1, w2] = await Promise.all([
    runNotificationWorker({ restaurantId: Rl.restaurantId, send: countSender }),
    runNotificationWorker({ restaurantId: Rl.restaurantId, send: countSender }),
  ]);
  const totalSent = w1.sent + w2.sent;
  // 2 jobs konfirmimi (mysafir+pronar); secili dërgohet saktësisht një herë në total.
  ok("asnjë dërgim i dyfishtë (lease)", calls === totalSent, `calls=${calls} sent=${totalSent}`);
  ok("çdo job u dërgua një herë", (await prisma.notificationJob.count({ where: { restaurantId: Rl.restaurantId, status: "Sent" } })) === totalSent);

  // ── 6) Cancel + reschedule jobs ──
  console.log("\n6. Cancel + reschedule:");
  const bc = await createReservation({ restaurantId: R.restaurantId, start: at(D, 21), partySize: 2, ...guest("cx@p5.local") });
  const cid = bc.ok ? bc.data!.reservationId : "";
  await cancelReservationByToken((await prisma.reservation.findUnique({ where: { id: cid }, select: { cancelToken: true } }))!.cancelToken);
  ok("job anulimi u krijua", (await prisma.notificationJob.count({ where: { reservationId: cid, type: "Cancellation" } })) >= 1);

  const br = await createReservation({ restaurantId: R.restaurantId, start: at(D, 22), partySize: 2, ...guest("rs@p5.local") });
  const rsid = br.ok ? br.data!.reservationId : "";
  await rescheduleReservation(R.restaurantId, rsid, at(D, 22, 30));
  ok("job riplanifikimi u krijua", (await prisma.notificationJob.count({ where: { reservationId: rsid, type: "Reschedule" } })) >= 1);

  // ── 7) Digest idempotent ──
  console.log("\n7. Digest ditor:");
  const dayStart = businessDateAtMinutes(D, 0, TZ);
  const dayEnd = businessDateAtMinutes(D, 24 * 60, TZ);
  const g1 = await generateDailyDigest(R.restaurantId, D, dayStart, dayEnd);
  const g2 = await generateDailyDigest(R.restaurantId, D, dayStart, dayEnd);
  ok("digest i parë u krijua", g1.created === true);
  ok("digest i dytë idempotent (s'u krijua)", g2.created === false);
  ok("vetëm një DailyReport për datën", (await prisma.dailyReport.count({ where: { restaurantId: R.restaurantId, reportDate: D } })) === 1);
  ok("një job digest", (await prisma.notificationJob.count({ where: { dedupeKey: `digest:${R.restaurantId}:${D}` } })) === 1);

  await cleanup();
  console.log(`\n──────── PHASE 5 RESULT: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
