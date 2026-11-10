/*
 * Teste për Fazën 10 — llogaritë (email/Google/Apple) dhe njoftimet e rezervimeve për biznesin.
 * Kundrejt Postgres LOKAL. Pa dërgime reale: email dhe WhatsApp përdorin dërgues të injektuar.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import { updateBookingSettings, setOpeningHours, createArea, createTable, purgeRestaurantBookingData } from "@/modules/booking/config";
import { createReservation, cancelReservationByToken, rescheduleReservation } from "@/modules/booking/reservations";
import { runNotificationWorker, type NotifySender } from "@/modules/booking/notifications";
import { bookingReference } from "@/modules/booking/business-notify";
import { addRecipient, verifyRecipient, resendCode } from "@/modules/booking/notification-recipients";
import { toBusinessDateKey, zonedTimeToUtc } from "@/modules/booking/timezone";
import { resolveOAuthSignIn, normalizeEmail } from "@/modules/accounts/oauth";
import { createLinkIntent, readLinkIntent } from "@/modules/accounts/link-intent";
import { findEmailConflicts } from "../scripts/audit-email-conflicts";

(function guardDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.ALLOW_NONLOCAL_TEST_DB === "1") return;
  if (!url || !/@(localhost|127\.0\.0\.1)/.test(url) || /neon\.tech|amazonaws|supabase|\.cloud/i.test(url)) {
    console.error("⛔ REFUZOHET: testet ekzekutohen vetëm kundrejt një DB LOKALE testimi.");
    process.exit(2);
  }
})();
process.env.NEXTAUTH_SECRET ||= "test-secret-phase10";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}
const SUF = "@p10.test";
const TZ = "Europe/Tirane";
const uniq = () => Math.random().toString(36).slice(2, 10);

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUF, mode: "insensitive" } }, select: { id: true } });
  const rests = await prisma.restaurant.findMany({ where: { ownerId: { in: users.map((u) => u.id) } }, select: { id: true } });
  for (const r of rests) await purgeRestaurantBookingData(r.id);
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
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

  // ───────────── LLOGARITË ─────────────
  console.log("1. Identiteti OAuth = provider + providerAccountId:");
  const gid = `g-${uniq()}`;
  const newEmail = `nou-${uniq()}${SUF}`;
  const c1 = await resolveOAuthSignIn({ provider: "google", providerAccountId: gid, email: newEmail, emailVerified: true });
  ok("identitet i ri → përdorues i ri", c1.ok && c1.how === "created");
  const created = c1.ok ? await prisma.user.findUnique({ where: { id: c1.userId }, select: { role: true, memberships: true, restaurants: true } }) : null;
  ok("përdoruesi i ri ka rol USER, pa restorant dhe pa membership", created?.role === "USER" && created.memberships.length === 0 && created.restaurants.length === 0);
  const c2 = await resolveOAuthSignIn({ provider: "google", providerAccountId: gid, email: "email-tjeter@example.org", emailVerified: true });
  ok("i njëjti identitet (edhe me email tjetër) → i njëjti përdorues", c2.ok && c1.ok && c2.userId === c1.userId && c2.how === "existing");

  console.log("\n2. Email që përputhet me llogari ekzistuese → pa përdorues të dytë, pa lidhje automatike:");
  const pwHash = await bcrypt.hash("Sekret123!", 4);
  const verified = await prisma.user.create({ data: { email: `ekziston-${uniq()}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: pwHash } });
  const before = await prisma.user.count();
  const c3 = await resolveOAuthSignIn({ provider: "google", providerAccountId: `g-${uniq()}`, email: verified.email.toUpperCase(), emailVerified: true });
  ok("refuzim account_exists (pavarësisht shkronjave të mëdha)", !c3.ok && c3.reason === "account_exists");
  ok("s'u krijua përdorues", (await prisma.user.count()) === before);
  ok("s'u krijua identitet i lidhur", (await prisma.oAuthAccount.count({ where: { userId: verified.id } })) === 0);
  const unverified = await prisma.user.create({ data: { email: `paverifikuar-${uniq()}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: false, passwordHash: pwHash } });
  const c4 = await resolveOAuthSignIn({ provider: "google", providerAccountId: `g-${uniq()}`, email: unverified.email, emailVerified: true });
  const uAfter = await prisma.user.findUnique({ where: { id: unverified.id } });
  ok("llogari e paverifikuar: refuzim, pa marrje", !c4.ok && c4.reason === "account_exists");
  ok("llogaria e paverifikuar mbetet e paprekur (fjalëkalimi + statusi)", uAfter?.passwordHash === pwHash && uAfter.emailVerified === false);

  console.log("\n3. Kërkesa paralele për të njëjtin identitet të ri:");
  const pid = `g-${uniq()}`;
  const pEmail = `paralel-${uniq()}${SUF}`;
  const [p1, p2, p3] = await Promise.all([1, 2, 3].map(() => resolveOAuthSignIn({ provider: "google", providerAccountId: pid, email: pEmail, emailVerified: true })));
  const ids = [p1, p2, p3].map((x) => (x.ok ? x.userId : "x"));
  ok("të gjitha hyjnë te i njëjti përdorues", new Set(ids).size === 1 && !ids.includes("x"), JSON.stringify([p1, p2, p3]));
  ok("1 përdorues + 1 identitet", (await prisma.user.count({ where: { email: pEmail } })) === 1 && (await prisma.oAuthAccount.count({ where: { providerAccountId: pid } })) === 1);

  console.log("\n4. Apple (Hide My Email) dhe lidhja e qëllimshme:");
  const relay = await resolveOAuthSignIn({ provider: "apple", providerAccountId: `a-${uniq()}`, email: `x${uniq()}@privaterelay.appleid.com`, emailVerified: true });
  ok("relay i panjohur → llogari e veçantë (s'hamendësohet se është i njëjti person)", relay.ok && relay.how === "created" && relay.userId !== verified.id);
  const memBefore = await prisma.restaurantMembership.count({ where: { userId: verified.id } });
  const appleId = `a-${uniq()}`;
  const link = await resolveOAuthSignIn({ provider: "apple", providerAccountId: appleId, email: `y${uniq()}@privaterelay.appleid.com`, emailVerified: true }, verified.id);
  ok("lidhja nga llogaria ekzistuese (me intent) → e lidhur", link.ok && link.how === "linked" && link.userId === verified.id);
  const vAfter = await prisma.user.findUnique({ where: { id: verified.id }, select: { role: true } });
  ok("lidhja s'krijon restorant/membership/rol të ri", (await prisma.restaurantMembership.count({ where: { userId: verified.id } })) === memBefore && vAfter?.role === "RESTAURANT_OWNER" && (await prisma.restaurant.count({ where: { ownerId: verified.id } })) === 0);
  const relogin = await resolveOAuthSignIn({ provider: "apple", providerAccountId: appleId, email: null, emailVerified: false });
  ok("hyrja e radhës me Apple (pa email) → llogaria e lidhur", relogin.ok && relogin.userId === verified.id);
  const conflict = await resolveOAuthSignIn({ provider: "apple", providerAccountId: appleId, email: null, emailVerified: false }, unverified.id);
  ok("identiteti i lidhur me tjetër → link_conflict", !conflict.ok && conflict.reason === "link_conflict");

  console.log("\n5. Urë kalimi për llogaritë e vjetra të Google:");
  const legacy = await prisma.user.create({ data: { email: `legacy-${uniq()}${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true } });
  const lg = await resolveOAuthSignIn({ provider: "google", providerAccountId: `g-${uniq()}`, email: legacy.email, emailVerified: true });
  ok("llogari pa fjalëkalim, e verifikuar, pa identitet → lidhet një herë", lg.ok && lg.how === "legacy_linked" && lg.userId === legacy.id);
  const lg2 = await resolveOAuthSignIn({ provider: "google", providerAccountId: `g-${uniq()}`, email: legacy.email, emailVerified: true });
  ok("një Google tjetër me të njëjtin email → refuzim", !lg2.ok && lg2.reason === "account_exists");
  const legacyApple = await prisma.user.create({ data: { email: `legacya-${uniq()}${SUF}`, role: "USER", emailVerified: true } });
  const la = await resolveOAuthSignIn({ provider: "apple", providerAccountId: `a-${uniq()}`, email: legacyApple.email, emailVerified: true });
  ok("Apple s'përdor kurrë urën", !la.ok && la.reason === "account_exists");

  console.log("\n6. Email i munguar / i pakonfirmuar:");
  const m1 = await resolveOAuthSignIn({ provider: "google", providerAccountId: `g-${uniq()}`, email: null, emailVerified: true });
  ok("pa email → missing_email", !m1.ok && m1.reason === "missing_email");
  const m2 = await resolveOAuthSignIn({ provider: "google", providerAccountId: `g-${uniq()}`, email: `x-${uniq()}${SUF}`, emailVerified: false });
  ok("email jo i konfirmuar → email_unverified", !m2.ok && m2.reason === "email_unverified");
  ok("normalizimi s'heq pika apo +", normalizeEmail("  A.B+tag@Gmail.COM ") === "a.b+tag@gmail.com");

  console.log("\n7. Link intent (cookie e nënshkruar):");
  const li = createLinkIntent("user-1", "google");
  ok("i vlefshëm për ofruesin e tij", readLinkIntent(li, "google") === "user-1");
  ok("refuzohet për ofrues tjetër", readLinkIntent(li, "apple") === null);
  ok("refuzohet nëse ndryshohet", readLinkIntent(li.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "google") === null);
  ok("refuzohet pas skadimit", readLinkIntent(createLinkIntent("user-1", "google", Date.now() - 11 * 60 * 1000), "google") === null);

  console.log("\n8. Unikësia e email-it të normalizuar:");
  let dupBlocked = false;
  try {
    await prisma.user.create({ data: { email: verified.email.toUpperCase(), role: "USER", emailVerified: false } });
  } catch {
    dupBlocked = true;
  }
  ok("DB refuzon një email që ndryshon vetëm në shkronja", dupBlocked);
  ok("auditimi s'gjen konflikte", (await findEmailConflicts()).length === 0);

  // ───────────── NJOFTIMET E BIZNESIT ─────────────
  console.log("\n9. Marrësit e njoftimeve (verifikim me kod):");
  const R = await makeResto(`njof-${uniq()}`);
  const sinkSent: { to: string; text: string }[] = [];
  const sink: NotifySender = async (m) => { sinkSent.push({ to: m.to, text: m.text }); return { delivered: false, simulated: true }; };
  const bizEmail = `recepsioni-${uniq()}${SUF}`;
  const e1 = await addRecipient(R.restaurantId, { channel: "Email", address: bizEmail.toUpperCase(), label: "Recepsioni" }, sink);
  ok("email shtohet dhe merr kod", e1.ok && sinkSent.length === 1);
  const w0 = await addRecipient(R.restaurantId, { channel: "WhatsApp", address: "+355 69 123 4567", consent: false }, sink);
  ok("WhatsApp pa pëlqim refuzohet", !w0.ok);
  const w1 = await addRecipient(R.restaurantId, { channel: "WhatsApp", address: "+355 69 123 4567", consent: true }, sink);
  ok("WhatsApp me pëlqim shtohet", w1.ok);
  const codeOf = (i: number) => /(\d{6})/.exec(sinkSent[i].text)![1];
  ok("kod i pasaktë refuzohet", !(await verifyRecipient(R.restaurantId, (e1 as { id: string }).id, "000000")).ok || codeOf(0) === "000000");
  ok("email verifikohet me kodin e saktë", (await verifyRecipient(R.restaurantId, (e1 as { id: string }).id, codeOf(0))).ok);
  ok("WhatsApp verifikohet me kodin e saktë", (await verifyRecipient(R.restaurantId, (w1 as { id: string }).id, codeOf(1))).ok);
  ok("kodi s'ripërdoret", !(await verifyRecipient(R.restaurantId, (e1 as { id: string }).id, codeOf(0))).ok);
  ok("tjetër restorant s'mund ta verifikojë", !(await resendCode("restorant-tjeter", (e1 as { id: string }).id, sink)).ok);
  await prisma.bookingSettings.update({ where: { restaurantId: R.restaurantId }, data: { notifyWhatsappEnabled: true } });

  console.log("\n10. Rezervim i ri → ruhet + dy njoftime biznesi (status i veçantë për kanal):");
  const D = futureDateKey(3);
  const b = await createReservation({ restaurantId: R.restaurantId, start: at(D, 19), partySize: 3, ...guest(`klient-${uniq()}${SUF}`) });
  ok("rezervimi u krijua", b.ok);
  const resId = b.ok ? b.data!.reservationId : "";
  const resv = await prisma.reservation.findUnique({ where: { id: resId } });
  ok("rezervimi shfaqet në panel (i ruajtur, Confirmed)", resv?.status === "Confirmed");
  const bizJobs = await prisma.notificationJob.findMany({ where: { reservationId: resId, type: "BusinessNewBooking" } });
  ok("2 job-e biznesi: Email + WhatsApp", bizJobs.length === 2 && bizJobs.some((j) => j.channel === "Email") && bizJobs.some((j) => j.channel === "WhatsApp"), JSON.stringify(bizJobs.map((j) => j.channel)));
  ok("pa fallback te pronari kur ka marrës email", !bizJobs.some((j) => j.recipient === R.ownerEmail));
  const pl = (bizJobs[0]?.payload ?? {}) as Record<string, string>;
  const cancelToken = resv?.cancelToken ?? "??";
  ok("mesazhi ka datë/orë, persona, referencë dhe link paneli", !!pl.when && String(pl.partySize) === "3" && pl.ref === bookingReference(resId) && String(pl.panelUrl).includes("/dashboard/reservations"));
  ok("mesazhi s'ka token anulimi as kontakt klienti", !JSON.stringify(bizJobs.map((j) => j.payload)).includes(cancelToken) && !JSON.stringify(bizJobs.map((j) => j.payload)).includes("klient-"));

  // Email OK, WhatsApp dështon: kanalet janë të pavarura dhe rezervimi s'preket.
  const failWA: NotifySender = async () => ({ delivered: false, error: "wa_provider_down" });
  const okEmail: NotifySender = async () => ({ delivered: true });
  await runNotificationWorker({ restaurantId: R.restaurantId, send: okEmail, sendWhatsApp: failWA });
  const after = await prisma.notificationJob.findMany({ where: { reservationId: resId, type: "BusinessNewBooking" } });
  ok("Email → Sent", after.find((j) => j.channel === "Email")?.status === "Sent");
  ok("WhatsApp → Failed (riprovim i planifikuar)", after.find((j) => j.channel === "WhatsApp")?.status === "Failed");
  ok("rezervimi mbetet Confirmed pas dështimit", (await prisma.reservation.findUnique({ where: { id: resId } }))?.status === "Confirmed");
  const later = new Date(Date.now() + 60 * 60 * 1000);
  await runNotificationWorker({ restaurantId: R.restaurantId, send: okEmail, sendWhatsApp: async () => ({ delivered: true }), now: later });
  ok("riprovimi i WhatsApp kalon → Sent", (await prisma.notificationJob.findFirst({ where: { reservationId: resId, type: "BusinessNewBooking", channel: "WhatsApp" } }))?.status === "Sent");
  ok("Email s'ridërgohet (pa dublikatë)", (await prisma.notificationDelivery.count({ where: { job: { reservationId: resId, type: "BusinessNewBooking", channel: "Email" } } })) === 1);

  console.log("\n11. Ndryshim orari dhe anulim:");
  const t1 = await prisma.restaurantTable.findFirst({ where: { restaurantId: R.restaurantId }, select: { id: true } });
  const rs = await rescheduleReservation(R.restaurantId, resId, at(D, 20), t1!.id);
  ok("ndryshimi i orarit kaloi", rs.ok);
  ok("2 njoftime biznesi për ndryshimin", (await prisma.notificationJob.count({ where: { reservationId: resId, type: "BusinessReschedule" } })) === 2);
  await cancelReservationByToken(cancelToken);
  await cancelReservationByToken(cancelToken); // idempotent
  ok("2 njoftime biznesi për anulimin (pa dublikata)", (await prisma.notificationJob.count({ where: { reservationId: resId, type: "BusinessCancellation" } })) === 2);

  console.log("\n12. Kanali i fikur dhe fallback te pronari:");
  const R2 = await makeResto(`fallback-${uniq()}`);
  const b2 = await createReservation({ restaurantId: R2.restaurantId, start: at(D, 19), partySize: 2, ...guest(`k2-${uniq()}${SUF}`) });
  const j2 = await prisma.notificationJob.findMany({ where: { reservationId: b2.ok ? b2.data!.reservationId : "", type: { startsWith: "Business" } } });
  ok("pa marrës: email te pronari (i verifikuar)", j2.length === 1 && j2[0].recipient === R2.ownerEmail && j2[0].channel === "Email");
  await prisma.bookingSettings.update({ where: { restaurantId: R2.restaurantId }, data: { notifyEmailEnabled: false } });
  const b3 = await createReservation({ restaurantId: R2.restaurantId, start: at(D, 20), partySize: 2, ...guest(`k3-${uniq()}${SUF}`) });
  ok("kanali email i fikur → asnjë njoftim biznesi", (await prisma.notificationJob.count({ where: { reservationId: b3.ok ? b3.data!.reservationId : "", type: { startsWith: "Business" } } })) === 0);
  ok("rezervimi si vizitor s'kërkon llogari (u krijua)", b3.ok);

  console.log("\n13. Riprovimi pa aktivitet të ri nga restoranti (dështim → cron → sukses):");
  {
    const R3 = await makeResto(`retry-${uniq()}`);
    const b4 = await createReservation({ restaurantId: R3.restaurantId, start: at(D, 18), partySize: 2, ...guest(`k4-${uniq()}${SUF}`) });
    const rid4 = b4.ok ? b4.data!.reservationId : "";
    const failing: NotifySender = async () => ({ delivered: false, error: "provider_down" });
    // Përpjekja 1 (si pas commit-it): dështon → Failed me backoff.
    await runNotificationWorker({ restaurantId: R3.restaurantId, send: failing });
    const jobs1 = await prisma.notificationJob.findMany({ where: { reservationId: rid4, type: { not: "Reminder24h" } } });
    ok("përpjekja 1 dështon → Failed, e riplanifikuar në të ardhmen", jobs1.length > 0 && jobs1.every((j) => j.status === "Failed" && j.attempts === 1 && j.scheduledAt.getTime() > Date.now()), JSON.stringify(jobs1.map((j) => [j.status, j.attempts])));
    // Koha kalon (backoff-i skadon); restoranti s'bën asgjë.
    await prisma.notificationJob.updateMany({ where: { reservationId: rid4, type: { not: "Reminder24h" } }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    // Mekanizmi automatik: endpoint-i i cron-it (pa restaurantId), me sekretin.
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "p10-cron-secret";
    const { GET: cronGET } = await import("../src/app/api/cron/notifications/route");
    const unauth = await cronGET(new Request("http://localhost/api/cron/notifications"));
    ok("cron-i pa sekret → 401", unauth.status === 401);
    const r = await cronGET(new Request("http://localhost/api/cron/notifications", { headers: { authorization: "Bearer p10-cron-secret" } }));
    process.env.CRON_SECRET = prev;
    ok("cron-i me sekret → 200", r.status === 200);
    const jobs2 = await prisma.notificationJob.findMany({ where: { reservationId: rid4, type: { not: "Reminder24h" } } });
    ok("përpjekja 2 nga cron-i → Simulated (pa dërgim real)", jobs2.every((j) => j.status === "Simulated" && j.attempts === 2), JSON.stringify(jobs2.map((j) => [j.status, j.attempts])));
    const del = await prisma.notificationDelivery.findMany({ where: { jobId: { in: jobs2.map((j) => j.id) } }, orderBy: { attempt: "asc" } });
    ok("historiku: 1 'failed' + 1 'simulated' për çdo job", jobs2.every((j) => { const d = del.filter((x) => x.jobId === j.id).map((x) => x.outcome); return d.join(",") === "failed,simulated"; }));
  }

  await cleanup();
  console.log(`\n──────── FAZA 10: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
