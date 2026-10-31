/*
 * Teste për Fazën 4 (motori i rezervimeve, multi-tenant) — kundrejt Postgres LOKAL.
 * Mbulon: izolim tenant, assignment single+kombinim, orare/mbyllje/slot caps,
 * kohëzgjatje+buffer, create/cancel/reschedule atomik, idempotencë, konkurrencë.
 */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import {
  createReservation,
  cancelReservationByToken,
  rescheduleReservation,
} from "@/modules/booking/reservations";
import {
  updateBookingSettings,
  setOpeningHours,
  createArea,
  createTable,
  createCombination,
  createClosure,
  createAreaClosure,
} from "@/modules/booking/config";
import { purgeRestaurantBookingData, deleteTable, setTableActive, deleteCustomer } from "@/modules/booking/config";
import { getAvailableTimes, isTableBookable } from "@/modules/booking/availability";
import { zonedTimeToUtc, toBusinessDateKey } from "@/modules/booking/timezone";

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
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

const SUF = "@test.local";
const TZ = "Europe/Tirane";
// Pastrimi i fixtures në RENDIN e duhur (rezervimet të parat), pa dobësuar FK-të:
// purge i të dhënave booking për çdo restorant testues, pastaj fshirja e user-ëve.
async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF } }, select: { id: true } });
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: users.map((u) => u.id) } }, select: { id: true } });
  for (const r of rests) await purgeRestaurantBookingData(r.id);
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
}

function futureDateKey(offsetDays: number): string {
  return toBusinessDateKey(new Date(Date.now() + offsetDays * 86400000), TZ);
}
function at(dateKey: string, hh: number, mm = 0): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return zonedTimeToUtc(y, m, d, hh, mm, 0, TZ).toISOString();
}

/** Restorant me BOOKING aktiv, orar çdo ditë 12:00–23:00, një zonë indoor + tavolina. */
async function makeBookingRestaurant(
  tag: string,
  tables: { name: string; seats: number }[],
  settings: Parameters<typeof updateBookingSettings>[1] = {}
) {
  const user = await prisma.user.create({
    data: { email: `${tag}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true },
    select: { id: true },
  });
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, user.id, `Resto ${tag}`));
  // Aktivizo BOOKING VETËM për këtë restorant testues (jo globalisht).
  const sub = await prisma.subscription.findUnique({ where: { restaurantId }, select: { id: true } });
  await prisma.moduleEntitlement.update({
    where: { subscriptionId_module: { subscriptionId: sub!.id, module: "BOOKING" } },
    data: { status: "active" },
  });
  await updateBookingSettings(restaurantId, settings);
  await setOpeningHours(
    restaurantId,
    [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "12:00", endTime: "23:00" }))
  );
  const area = await createArea(restaurantId, { name: "Brenda", kind: "indoor" });
  const tableIds: string[] = [];
  for (const t of tables) {
    const r = await createTable(restaurantId, { name: t.name, seats: t.seats, areaId: area.id });
    if (r.ok) tableIds.push(r.data!.id);
  }
  return { userId: user.id, restaurantId, areaId: area.id, tableIds };
}

function guest(phone: string) {
  return { firstName: "Mysafir", lastName: "Test", phone };
}

async function main() {
  await cleanup();
  const D = futureDateKey(7);

  // ── 1) Izolim tenant ──
  console.log("\n1. Izolim tenant:");
  const A = await makeBookingRestaurant("p4a", [{ name: "A1", seats: 4 }]);
  const B = await makeBookingRestaurant("p4b", [{ name: "B1", seats: 4 }]);

  const rA = await createReservation({ restaurantId: A.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000001") });
  ok("rezervim A ok", rA.ok, JSON.stringify(rA));
  // I njëjti slot te B nuk preket nga A (tavolina të ndara).
  const rB = await createReservation({ restaurantId: B.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000002") });
  ok("rezervim B i njëjti slot ok (izolim)", rB.ok, JSON.stringify(rB));

  // Tavolina e A nuk është e rezervueshme nën B (izolim tenant).
  ok("tavolina e A s'është e rezervueshme nën B", (await isTableBookable({ restaurantId: B.restaurantId, tableId: A.tableIds[0], start: new Date(at(D, 20)), partySize: 2 })) === false);
  // Rezervim te B që kërkon tavolinën e A → refuzohet.
  const crossBook = await createReservation({ restaurantId: B.restaurantId, start: at(D, 20), partySize: 2, tableId: A.tableIds[0], ...guest("+355690000003") });
  ok("rezervim cross-tenant me tavolinë të huaj → refuzohet", !crossBook.ok);

  // Klient me të njëjtin telefon në A dhe B → dy klientë të ndarë.
  const phone = "+355691111111";
  await createReservation({ restaurantId: A.restaurantId, start: at(D, 21), partySize: 2, ...guest(phone) });
  await createReservation({ restaurantId: B.restaurantId, start: at(D, 21), partySize: 2, ...guest(phone) });
  const custA = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId: A.restaurantId, phone } }, select: { id: true } });
  const custB = await prisma.customer.findUnique({ where: { restaurantId_phone: { restaurantId: B.restaurantId, phone } }, select: { id: true } });
  ok("klientë të ndarë sipas restorantit", !!custA && !!custB && custA!.id !== custB!.id);

  // ── 2) Gate orari / mbyllje ──
  console.log("\n2. Orari + mbyllje:");
  const H = await makeBookingRestaurant("p4h", [{ name: "H1", seats: 4 }]);
  ok("jashtë orarit (09:00) → refuzohet", !(await createReservation({ restaurantId: H.restaurantId, start: at(D, 9), partySize: 2, ...guest("+355690000010") })).ok);
  ok("brenda orarit (19:00) → ok", (await createReservation({ restaurantId: H.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000011") })).ok);
  // Mbyllje e të gjithë restorantit për një ditë tjetër → asnjë slot.
  const Dc = futureDateKey(8);
  const [cy, cm, cd] = Dc.split("-").map(Number);
  await createClosure(H.restaurantId, { startDate: zonedTimeToUtc(cy, cm, cd, 0, 0, 0, TZ), endDate: zonedTimeToUtc(cy, cm, cd, 23, 59, 0, TZ) });
  ok("ditë e mbyllur → asnjë slot", (await getAvailableTimes({ restaurantId: H.restaurantId, dateStr: Dc, partySize: 2 })).length === 0);
  ok("ditë e mbyllur → rezervim refuzohet", !(await createReservation({ restaurantId: H.restaurantId, start: at(Dc, 19), partySize: 2, ...guest("+355690000012") })).ok);

  // ── 3) Mbyllje zone ──
  console.log("\n3. Mbyllje zone:");
  const Z = await makeBookingRestaurant("p4z", [{ name: "Z1", seats: 4 }]);
  await createAreaClosure(Z.restaurantId, { areaId: Z.areaId, startDateTime: new Date(at(D, 18)), endDateTime: new Date(at(D, 22)) });
  ok("mbyllje zone → tavolina e zonës jo e disponueshme", !(await createReservation({ restaurantId: Z.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000020") })).ok);
  ok("jashtë dritares së mbylljes → ok", (await createReservation({ restaurantId: Z.restaurantId, start: at(D, 22, 30), partySize: 2, ...guest("+355690000021") })).ok);

  // ── 4) Kombinim tavolinash ──
  console.log("\n4. Kombinim tavolinash:");
  const C = await makeBookingRestaurant("p4c", [{ name: "C1", seats: 2 }, { name: "C2", seats: 2 }]);
  const combo = await createCombination(C.restaurantId, { name: "C1+C2", areaId: C.areaId, maxSeats: 4, memberTableIds: C.tableIds });
  ok("kombinimi u krijua", combo.ok, JSON.stringify(combo));
  const rCombo = await createReservation({ restaurantId: C.restaurantId, start: at(D, 19), partySize: 4, ...guest("+355690000030") });
  ok("grup 4 pa tavolinë të vetme → zihet me kombinim", rCombo.ok, JSON.stringify(rCombo));
  if (rCombo.ok) {
    const rtCount = await prisma.reservationTable.count({ where: { reservationId: rCombo.data!.reservationId } });
    ok("kombinimi mban TË DYJA tavolinat", rtCount === 2, `rt=${rtCount}`);
  }

  // ── 5) Slot caps ──
  console.log("\n5. Slot caps:");
  const S = await makeBookingRestaurant("p4s", [{ name: "S1", seats: 4 }, { name: "S2", seats: 4 }], { maxReservationsPerSlot: 1 });
  ok("rezervim 1 @slot → ok", (await createReservation({ restaurantId: S.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000040") })).ok);
  ok("rezervim 2 @të njëjtin slot → SLOT_FULL", !(await createReservation({ restaurantId: S.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000041") })).ok);
  ok("rezervim @slot tjetër → ok", (await createReservation({ restaurantId: S.restaurantId, start: at(D, 20), partySize: 2, ...guest("+355690000042") })).ok);

  // ── 6) Kohëzgjatje + buffer (e njëjta tavolinë) ──
  console.log("\n6. Kohëzgjatje + buffer:");
  const T = await makeBookingRestaurant("p4t", [{ name: "T1", seats: 4 }]);
  const firstT = await createReservation({ restaurantId: T.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000050") });
  ok("rezervim i parë 19:00 ok", firstT.ok);
  // 21:00 = fundi i seancës (19:00+120); buffer 15' → 21:00 ende i zënë.
  ok("brenda buffer-it (21:00) → refuzohet", !(await createReservation({ restaurantId: T.restaurantId, start: at(D, 21), partySize: 2, tableId: T.tableIds[0], ...guest("+355690000051") })).ok);
  // 21:30 = pas seancës + buffer → i lirë.
  ok("pas seancës+buffer (21:30) → ok", (await createReservation({ restaurantId: T.restaurantId, start: at(D, 21, 30), partySize: 2, tableId: T.tableIds[0], ...guest("+355690000052") })).ok);

  // ── 7) Anulim + riplanifikim atomik ──
  console.log("\n7. Anulim + riplanifikim:");
  const R = await makeBookingRestaurant("p4r", [{ name: "R1", seats: 4 }]);
  const resv = await createReservation({ restaurantId: R.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000060") });
  ok("rezervim ok", resv.ok);
  if (resv.ok) {
    // Anulim → liron tavolinën.
    const cancel = await cancelReservationByToken(resv.data!.cancelToken);
    ok("anulim ok", cancel.ok);
    const after = await prisma.reservation.findUnique({ where: { id: resv.data!.reservationId }, select: { status: true } });
    ok("statusi = Cancelled", after?.status === "Cancelled");
    ok("tavolina u lirua (slot i ri @19:00 ok)", (await createReservation({ restaurantId: R.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000061") })).ok);
    ok("anulim përsëri (idempotent) ok", (await cancelReservationByToken(resv.data!.cancelToken)).ok);
  }
  // Riplanifikim: krijo @19:00, zhvendos @20:00 → 19:00 lirohet, 20:00 zihet.
  const R2 = await makeBookingRestaurant("p4r2", [{ name: "R2a", seats: 4 }]);
  const toMove = await createReservation({ restaurantId: R2.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000062") });
  if (toMove.ok) {
    // Zhvendos te 22:30 (pa mbivendosje me 19:00–21:00) që slot-i i vjetër të lirohet vërtet.
    const resched = await rescheduleReservation(R2.restaurantId, toMove.data!.reservationId, at(D, 22, 30));
    ok("riplanifikim ok", resched.ok, JSON.stringify(resched));
    const moved = await prisma.reservation.findUnique({ where: { id: toMove.data!.reservationId }, select: { startDateTime: true } });
    ok("ora e re = 22:30", moved?.startDateTime.toISOString() === at(D, 22, 30));
    const rtOne = await prisma.reservationTable.count({ where: { reservationId: toMove.data!.reservationId } });
    ok("saktësisht një ReservationTable pas riplanifikimit", rtOne === 1, `rt=${rtOne}`);
    ok("slot i vjetër (19:00) u lirua", (await createReservation({ restaurantId: R2.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000063") })).ok);
  }

  // ── 8) Idempotencë ──
  console.log("\n8. Idempotencë:");
  const I = await makeBookingRestaurant("p4i", [{ name: "I1", seats: 4 }]);
  const key = "idem-key-123";
  const i1 = await createReservation({ restaurantId: I.restaurantId, start: at(D, 19), partySize: 2, idempotencyKey: key, ...guest("+355690000070") });
  const i2 = await createReservation({ restaurantId: I.restaurantId, start: at(D, 19), partySize: 2, idempotencyKey: key, ...guest("+355690000070") });
  ok("të dyja ok", i1.ok && i2.ok);
  ok("i njëjti reservationId (replay)", i1.ok && i2.ok && i1.data!.reservationId === i2.data!.reservationId);
  ok("vetëm një rresht rezervimi", (await prisma.reservation.count({ where: { restaurantId: I.restaurantId } })) === 1);

  // ── 9) Konkurrencë (tavolinë e vetme, dy kërkesa paralele) ──
  console.log("\n9. Konkurrencë:");
  const K = await makeBookingRestaurant("p4k", [{ name: "K1", seats: 2 }]);
  const [k1, k2] = await Promise.all([
    createReservation({ restaurantId: K.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000080") }),
    createReservation({ restaurantId: K.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000081") }),
  ]);
  ok("saktësisht një fiton tavolinën e vetme", (k1.ok ? 1 : 0) + (k2.ok ? 1 : 0) === 1, `k1=${k1.ok} k2=${k2.ok}`);
  ok("vetëm një rezervim aktiv @slot", (await prisma.reservation.count({ where: { restaurantId: K.restaurantId, status: { notIn: ["Cancelled", "NoShow"] } } })) === 1);

  // Konkurrencë idempotency: dy paralele me të njëjtin çelës → një rezervim.
  const K2 = await makeBookingRestaurant("p4k2", [{ name: "K2a", seats: 4 }, { name: "K2b", seats: 4 }]);
  const ckey = "concurrent-idem";
  const [c1, c2] = await Promise.all([
    createReservation({ restaurantId: K2.restaurantId, start: at(D, 19), partySize: 2, idempotencyKey: ckey, ...guest("+355690000090") }),
    createReservation({ restaurantId: K2.restaurantId, start: at(D, 19), partySize: 2, idempotencyKey: ckey, ...guest("+355690000090") }),
  ]);
  ok("idempotency paralele → të dyja ok, një rresht", c1.ok && c2.ok && (await prisma.reservation.count({ where: { restaurantId: K2.restaurantId } })) === 1);

  // ── 10) Gate i entitlement-it BOOKING ──
  console.log("\n10. Entitlement BOOKING:");
  const E = await makeBookingRestaurant("p4e", [{ name: "E1", seats: 4 }]);
  const subE = await prisma.subscription.findUnique({ where: { restaurantId: E.restaurantId }, select: { id: true } });
  await prisma.moduleEntitlement.update({ where: { subscriptionId_module: { subscriptionId: subE!.id, module: "BOOKING" } }, data: { status: "disabled" } });
  ok("BOOKING joaktiv → rezervim refuzohet", !(await createReservation({ restaurantId: E.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000100") })).ok);

  // ── 11) Ruajtja e historikut (regression) ──
  console.log("\n11. Ruajtja e historikut:");
  const Hx = await makeBookingRestaurant("p4hx", [{ name: "HX1", seats: 4 }]);
  const hxBook = await createReservation({ restaurantId: Hx.restaurantId, start: at(D, 19), partySize: 2, ...guest("+355690000110") });
  ok("rezervim ok", hxBook.ok);
  // Tavolina me histori → fshirja refuzohet (sugjeron çaktivizim).
  const delT = await deleteTable(Hx.restaurantId, Hx.tableIds[0]);
  ok("fshirja e tavolinës me histori → refuzohet", !delT.ok, JSON.stringify(delT));
  // FK e fortë: fshirja direkte në DB hedh gabim (nuk dobësohet).
  let fkThrew = false;
  try { await prisma.restaurantTable.delete({ where: { id: Hx.tableIds[0] } }); } catch { fkThrew = true; }
  ok("FK RESTRICT pengon fshirjen direkte në DB", fkThrew);
  // Rezervimi mbetet (historia ruhet).
  ok("rezervimi (historia) ende ekziston", (await prisma.reservation.count({ where: { restaurantId: Hx.restaurantId } })) === 1);
  // Çaktivizimi është rruga e duhur.
  const deact = await setTableActive(Hx.restaurantId, Hx.tableIds[0], false);
  ok("çaktivizimi i tavolinës → ok", deact.ok);
  ok("tavolina u çaktivizua (isActive=false)", (await prisma.restaurantTable.findUnique({ where: { id: Hx.tableIds[0] }, select: { isActive: true } }))?.isActive === false);
  // Klienti me rezervime → fshirja refuzohet (politikë eksplicite).
  const cust = await prisma.customer.findFirst({ where: { restaurantId: Hx.restaurantId }, select: { id: true } });
  const delC = await deleteCustomer(Hx.restaurantId, cust!.id);
  ok("fshirja e klientit me rezervime → refuzohet", !delC.ok, JSON.stringify(delC));

  await cleanup();
  console.log(`\n──────── PHASE 4 RESULT: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
