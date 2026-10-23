/*
 * Teste për verifikimin e email-it + rate-limit — kundrejt një Postgres LOKAL testimi.
 *
 * EKZEKUTIMI (shih tests/README.md për setup-in e plotë të DB-së):
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/onlinemenu_test \
 *   DIRECT_URL=$DATABASE_URL  npm test
 *
 * MBROJTJA E DB-SË: skripti REFUZON të niset nëse DATABASE_URL s'është lokale
 * (ose duket si Neon), sepse pastron të dhëna (deleteMany). Kjo parandalon që testet
 * të prekin aksidentalisht prodhimin. Për të anashkaluar me vetëdije (jo i rekomanduar):
 *   ALLOW_NONLOCAL_TEST_DB=1
 */
import { prisma } from "@/lib/prisma";
import {
  issueVerification,
  consumeVerification,
  createPendingRegistration,
  MAX_CODE_ATTEMPTS,
} from "@/lib/email-verification";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";

// Provisionim brenda një transaksioni (createRestaurantForOwner kërkon tx për lock-un).
const provision = (ownerId: string, name: string) =>
  prisma.$transaction((tx) => createRestaurantForOwner(tx, ownerId, name));
import { rateLimit } from "@/lib/rate-limit";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

// ── MBROJTJA E DB-SË ──
(function guardDb() {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url) || url.includes("@localhost") || url.includes("@127.0.0.1");
  const looksRemote = /neon\.tech|amazonaws|supabase|\.cloud/i.test(url);
  if (process.env.ALLOW_NONLOCAL_TEST_DB === "1") return;
  if (!url || !isLocal || looksRemote) {
    console.error("⛔ REFUZOHET: testet ekzekutohen vetëm kundrejt një DB LOKALE testimi.");
    console.error(`   DATABASE_URL aktuale nuk duket lokale: "${url.replace(/\/\/[^@]*@/, "//***@")}"`);
    process.exit(2);
  }
})();

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

const SUF = "@test.local";
async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "test:" } } });
}

async function makeUnverifiedOwner(email: string, opts: { password?: string; pending?: string } = {}) {
  return prisma.user.create({
    data: {
      email,
      role: "RESTAURANT_OWNER",
      emailVerified: false,
      passwordHash: opts.password ? await bcrypt.hash(opts.password, 10) : null,
      pendingRestaurantName: opts.pending ?? "Resto Test",
    },
    select: { id: true, email: true },
  });
}
const restaurantCount = (ownerId: string) => prisma.restaurant.count({ where: { ownerId } });
const trialCount = (ownerId: string) =>
  prisma.subscription.count({ where: { restaurant: { ownerId }, status: "trial" } });

function authorizeOf(id: string) {
  // NextAuth v4: parseProviders bën merge(rest, options) dhe id = options.id ?? rest.id.
  const p = (authOptions.providers as any[]).find((x) => (x.options?.id ?? x.id) === id);
  return (p.options?.authorize ?? p.authorize).bind(p);
}

async function main() {
  await cleanup();

  // ── T1: Link happy path ──
  console.log("\nT1 link happy path:");
  {
    const u = await makeUnverifiedOwner(`t1${SUF}`, { pending: "Gurra e Kuqe" });
    const { token } = await issueVerification(u.id);
    const r = await consumeVerification({ token });
    ok("consume ok", r.status === "ok");
    ok("emailVerified=true", (await prisma.user.findUnique({ where: { id: u.id } }))?.emailVerified === true);
    ok("1 restaurant", (await restaurantCount(u.id)) === 1);
    ok("1 trial", (await trialCount(u.id)) === 1);
    ok("slug nga pending", (await prisma.restaurant.findFirst({ where: { ownerId: u.id } }))?.slug === "gurra-e-kuqe");
  }

  // ── T2: Replay ──
  console.log("\nT2 replay (token i përdorur):");
  {
    const u = await makeUnverifiedOwner(`t2${SUF}`);
    const { token } = await issueVerification(u.id);
    const a = await consumeVerification({ token });
    const b = await consumeVerification({ token });
    ok("1-i ok", a.status === "ok");
    ok("2-i expired", b.status === "expired", `=${b.status}`);
    ok("1 restaurant", (await restaurantCount(u.id)) === 1);
  }

  // ── T3: Code happy path ──
  console.log("\nT3 code happy path:");
  {
    const u = await makeUnverifiedOwner(`t3${SUF}`);
    const { code } = await issueVerification(u.id);
    const r = await consumeVerification({ email: u.email, code });
    ok("consume me kod ok", r.status === "ok", `=${r.status}`);
    ok("1 restaurant", (await restaurantCount(u.id)) === 1);
    ok("1 trial", (await trialCount(u.id)) === 1);
  }

  // ── T4: Wrong code + lock ──
  console.log("\nT4 wrong code + lock:");
  {
    const u = await makeUnverifiedOwner(`t4${SUF}`);
    await issueVerification(u.id);
    const res: string[] = [];
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) res.push((await consumeVerification({ email: u.email, code: "000000" })).status);
    ok("wrong_code…locked", res.slice(0, -1).every((s) => s === "wrong_code") && res.at(-1) === "locked", `=${res.join(",")}`);
    ok("s'u krijua restaurant", (await restaurantCount(u.id)) === 0);
  }

  // ── T5: Skadim ──
  console.log("\nT5 expiry:");
  {
    const u = await makeUnverifiedOwner(`t5${SUF}`);
    const { token, code } = await issueVerification(u.id);
    await prisma.emailVerification.update({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    ok("token skaduar → expired", (await consumeVerification({ token })).status === "expired");
    ok("kod skaduar → expired", (await consumeVerification({ email: u.email, code })).status === "expired");
    ok("s'u krijua restaurant", (await restaurantCount(u.id)) === 0);
  }

  // ── T6: Resend invalidon të vjetrin ──
  console.log("\nT6 resend invalidon old + rrit version:");
  {
    const u = await makeUnverifiedOwner(`t6${SUF}`);
    const a = await issueVerification(u.id);
    const v0 = (await prisma.emailVerification.findUnique({ where: { userId: u.id } }))!.version;
    const b = await issueVerification(u.id);
    const v1 = (await prisma.emailVerification.findUnique({ where: { userId: u.id } }))!.version;
    ok("version u rrit (v1>v0)", v1 === v0 + 1, `v0=${v0} v1=${v1}`);
    ok("token i vjetër → invalid", (await consumeVerification({ token: a.token })).status === "invalid");
    ok("token i ri → ok", (await consumeVerification({ token: b.token })).status === "ok");
    ok("1 restaurant", (await restaurantCount(u.id)) === 1);
  }

  // ── T7: Concurrency (token ‖ token) ──
  console.log("\nT7 concurrency token‖token:");
  {
    const u = await makeUnverifiedOwner(`t7${SUF}`);
    const { token } = await issueVerification(u.id);
    const [r1, r2] = await Promise.all([consumeVerification({ token }), consumeVerification({ token })]);
    ok("saktësisht 1 ok", [r1, r2].filter((r) => r.status === "ok").length === 1, `=${r1.status},${r2.status}`);
    ok("1 restaurant", (await restaurantCount(u.id)) === 1);
    ok("1 trial", (await trialCount(u.id)) === 1);
  }

  // ── T7b: Concurrency (token ‖ code) ──
  console.log("\nT7b concurrency token‖code:");
  {
    const u = await makeUnverifiedOwner(`t7b${SUF}`);
    const { token, code } = await issueVerification(u.id);
    const [r1, r2] = await Promise.all([consumeVerification({ token }), consumeVerification({ email: u.email, code })]);
    ok("saktësisht 1 ok", [r1, r2].filter((r) => r.status === "ok").length === 1, `=${r1.status},${r2.status}`);
    ok("1 restaurant", (await restaurantCount(u.id)) === 1);
  }

  // ── T8: Verify ‖ Resend njëkohësisht ──
  console.log("\nT8 verify ‖ resend (concurrency):");
  {
    const u = await makeUnverifiedOwner(`t8${SUF}`);
    const { token } = await issueVerification(u.id);
    // Konsumim i token-it të vjetër njëkohësisht me një ri-dërgim.
    const [consumeRes] = await Promise.all([
      consumeVerification({ token }),
      issueVerification(u.id), // resend → version++ , token i ri
    ]);
    // Pavarësisht kush fiton garën: NUK ka gjendje të pjesshme, max 1 restaurant.
    ok("≤1 restaurant", (await restaurantCount(u.id)) <= 1, `count=${await restaurantCount(u.id)}`);
    const verified = (await prisma.user.findUnique({ where: { id: u.id } }))?.emailVerified;
    // Nëse consume fitoi → verified+1 restaurant; nëse resend fitoi → token i vjetër s'konsumoi.
    ok("konsistencë verified↔restaurant", verified === ((await restaurantCount(u.id)) === 1), `verified=${verified}, consume=${consumeRes.status}`);
  }

  // ── T8b: Version guard i drejtpërdrejtë ──
  console.log("\nT8b version-guard (CAS me version të vjetër):");
  {
    const u = await makeUnverifiedOwner(`t8b${SUF}`);
    await issueVerification(u.id);
    const rec = (await prisma.emailVerification.findUnique({ where: { userId: u.id } }))!;
    await issueVerification(u.id); // version++
    const cas = await prisma.emailVerification.updateMany({
      where: { id: rec.id, version: rec.version, used: false }, // version i vjetër
      data: { used: true },
    });
    ok("CAS me version të vjetër → 0 rreshta", cas.count === 0, `count=${cas.count}`);
  }

  // ── T9: Tentativa kodi PARALELE (increment atomik) ──
  console.log("\nT9 parallel wrong-code attempts (atomic):");
  {
    const u = await makeUnverifiedOwner(`t9${SUF}`);
    const { code } = await issueVerification(u.id);
    // 5 kode të gabuara njëkohësisht.
    const wrong = await Promise.all(Array.from({ length: MAX_CODE_ATTEMPTS }, () => consumeVerification({ email: u.email, code: "999999" })));
    const attempts = (await prisma.emailVerification.findUnique({ where: { userId: u.id } }))!.attempts;
    ok("attempts == 5 (pa humbje update-sh)", attempts === MAX_CODE_ATTEMPTS, `attempts=${attempts}`);
    ok("asnjë ok mes të gabuarve", wrong.every((r) => r.status !== "ok"));
    // Pas lock-ut, edhe kodi i saktë s'kalon.
    const afterLock = await consumeVerification({ email: u.email, code });
    ok("kod i saktë pas lock → locked", afterLock.status === "locked", `=${afterLock.status}`);
    ok("s'u krijua restaurant", (await restaurantCount(u.id)) === 0);
  }

  // ── T10: Dështim transaksioni → rollback (asnjë konsumim i pjesshëm) ──
  console.log("\nT10 transaction failure → rollback:");
  {
    const u = await makeUnverifiedOwner(`t10${SUF}`);
    await issueVerification(u.id);
    const rec = (await prisma.emailVerification.findUnique({ where: { userId: u.id } }))!;
    let threw = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.emailVerification.updateMany({ where: { id: rec.id, used: false }, data: { used: true } });
        await tx.user.update({ where: { id: u.id }, data: { emailVerified: true } });
        throw new Error("simulim dështimi pas CAS"); // p.sh. krijimi i restorantit dështon
      });
    } catch { threw = true; }
    ok("transaksioni hodhi", threw);
    const after = await prisma.emailVerification.findUnique({ where: { userId: u.id } });
    ok("used mbeti false (rollback)", after?.used === false);
    ok("user s'u verifikua (rollback)", (await prisma.user.findUnique({ where: { id: u.id } }))?.emailVerified === false);
    ok("s'u krijua restaurant", (await restaurantCount(u.id)) === 0);
    // Pas rollback-ut, konsumimi i rregullt ende funksionon.
    const { token } = await issueVerification(u.id);
    ok("consume pas rollback → ok", (await consumeVerification({ token })).status === "ok");
  }

  // ── T11: Login gate në server ──
  console.log("\nT11 server login gate:");
  {
    const authorize = authorizeOf("credentials");
    const u = await makeUnverifiedOwner(`t11${SUF}`, { password: "secret123" });
    let threw = "";
    try { await authorize({ email: u.email, password: "secret123" }, {}); } catch (e: any) { threw = e.message; }
    ok("i paverifikuar → throw EMAIL_NOT_VERIFIED", threw === "EMAIL_NOT_VERIFIED", `=${threw}`);
    ok("password gabim → null", (await authorize({ email: u.email, password: "x" }, {})) === null);
    await prisma.user.update({ where: { id: u.id }, data: { emailVerified: true } });
    const good = await authorize({ email: u.email, password: "secret123" }, {});
    ok("i verifikuar → user", !!good && good.id === u.id);
  }

  // ── T12: Google signIn — gating + linking i sigurt ──
  console.log("\nT12 Google signIn (gating + safe linking):");
  {
    const signInCb = authOptions.callbacks!.signIn!;
    const g = (email: string, email_verified: any) =>
      signInCb({ user: { email } as any, account: { provider: "google" } as any, profile: { email_verified } as any } as any);

    const e1 = `g1${SUF}`;
    ok("verified=true → lejon", (await g(e1, true)) === true);
    ok("krijon user verified", (await prisma.user.findUnique({ where: { email: e1 } }))?.emailVerified === true);
    const e2 = `g2${SUF}`;
    ok("verified=false → refuzon", (await g(e2, false)) === false);
    ok("s'krijon user", (await prisma.user.findUnique({ where: { email: e2 } })) === null);
    ok("verified=undefined → refuzon", (await g(`g3${SUF}`, undefined)) === false);

    // Linking i sigurt: llogari e paverifikuar me password + verifikim në fluturim.
    const e4 = `g4${SUF}`;
    const u4 = await makeUnverifiedOwner(e4, { password: "attacker-pw" });
    await issueVerification(u4.id);
    ok("linking lejon", (await g(e4, true)) === true);
    const after = await prisma.user.findUnique({ where: { id: u4.id } });
    ok("u verifikua", after?.emailVerified === true);
    ok("passwordHash u HOQ (jo i besueshëm)", after?.passwordHash === null, `pw=${after?.passwordHash}`);
    ok("pendingRestaurantName u pastrua", after?.pendingRestaurantName === null);
    ok("verifikimi në fluturim u fshi", (await prisma.emailVerification.count({ where: { userId: u4.id } })) === 0);
  }

  // ── T13: createRestaurantForOwner idempotent ──
  console.log("\nT13 createRestaurantForOwner idempotent:");
  {
    const u = await makeUnverifiedOwner(`t13${SUF}`);
    const a = await provision(u.id, "Resto X");
    const b = await provision(u.id, "Resto X");
    ok("1-i created=true", a.created === true);
    ok("2-i created=false", b.created === false);
    ok("1 restaurant", (await restaurantCount(u.id)) === 1);
  }

  // ── T14: Backfill i kufizuar (kriter: owns-restaurant OSE super_admin) ──
  console.log("\nT14 limited backfill:");
  {
    const owner = await makeUnverifiedOwner(`bf-owner${SUF}`);
    await provision(owner.id, "Legacy Resto"); // legacy: zotëron restaurant
    await prisma.user.update({ where: { id: owner.id }, data: { emailVerified: false } }); // rikthe false për testin
    const fresh = await makeUnverifiedOwner(`bf-new${SUF}`); // regjistrim i ri: pa restaurant
    const admin = await prisma.user.create({
      data: { email: `bf-admin${SUF}`, role: "SUPER_ADMIN", emailVerified: false },
      select: { id: true },
    });
    // Pikërisht UPDATE-i i migrimit:
    await prisma.$executeRaw`
      UPDATE "User" SET "emailVerified" = true
      WHERE "emailVerified" = false
        AND ("role" = 'SUPER_ADMIN' OR "id" IN (SELECT "ownerId" FROM "Restaurant"))`;
    ok("legacy owner → verified", (await prisma.user.findUnique({ where: { id: owner.id } }))?.emailVerified === true);
    ok("regjistrim i ri → MBETET false", (await prisma.user.findUnique({ where: { id: fresh.id } }))?.emailVerified === false);
    ok("super_admin → verified", (await prisma.user.findUnique({ where: { id: admin.id } }))?.emailVerified === true);
  }

  // ── T15: Rate limit i PostgreSQL ──
  console.log("\nT15 PostgreSQL rate limit:");
  {
    const key = "test:rl:1.2.3.4";
    const r = [] as boolean[];
    for (let i = 0; i < 4; i++) r.push(await rateLimit(key, 3, 60_000));
    ok("3 të parat lejohen, 4-ta jo", r[0] && r[1] && r[2] && !r[3], `=${r.join(",")}`);
    // Pas skadimit të dritares → rivendoset.
    await prisma.rateLimit.update({ where: { key }, data: { resetAt: new Date(Date.now() - 1000) } });
    ok("pas skadimit → lejohet sërish", (await rateLimit(key, 3, 60_000)) === true);

    // Konkurrencë: 10 thirrje njëkohësisht me limit 5 → saktësisht 5 lejohen.
    const key2 = "test:rl:concurrent";
    const many = await Promise.all(Array.from({ length: 10 }, () => rateLimit(key2, 5, 60_000)));
    ok("concurrency: saktësisht 5 lejohen", many.filter(Boolean).length === 5, `allowed=${many.filter(Boolean).length}`);
  }

  // ── T16: Re-registration "latest-wins" — invalidim atomik i kredencialit të vjetër ──
  console.log("\nT16 re-registration latest-wins (atomic):");
  {
    const email = `t16${SUF}`;
    const r1 = await createPendingRegistration(email, "password-ONE", "Resto One");
    const r2 = await createPendingRegistration(email, "password-TWO", "Resto Two");
    ok("të dyja ok", r1.status === "ok" && r2.status === "ok");
    if (r1.status === "ok" && r2.status === "ok") {
      ok("tokenat ndryshojnë", r1.token !== r2.token);
      // Linku/kodi i VJETËR s'duhet të verifikojë (password-i tani është i kërkesës së dytë).
      ok("token i vjetër → invalid", (await consumeVerification({ token: r1.token })).status === "invalid");
      ok("kod i vjetër → s'kalon", ["wrong_code", "invalid", "expired"].includes((await consumeVerification({ email, code: r1.code })).status));
      // Password-i aktiv është i kërkesës së fundit (latest-wins).
      const u = await prisma.user.findUnique({ where: { email } });
      ok("passwordHash = i kërkesës së dytë", u ? await bcrypt.compare("password-TWO", u.passwordHash!) : false);
      ok("jo i kërkesës së parë", u ? !(await bcrypt.compare("password-ONE", u.passwordHash!)) : false);
      // Kredenciali i RI verifikon dhe krijon restorantin e kërkesës së dytë.
      ok("token i ri → ok", (await consumeVerification({ token: r2.token })).status === "ok");
      ok("slug nga 'Resto Two'", (await prisma.restaurant.findFirst({ where: { ownerId: u!.id } }))?.slug === "resto-two");
      // Pas verifikimit: re-registration → already_verified (s'mbishkruhet).
      ok("re-register pas verifikimit → already_verified", (await createPendingRegistration(email, "x-nope", "X")).status === "already_verified");
    }
  }

  // ── T17: Verify fail-CLOSED kur limiter-i s'arrihet (pa konsumim kredenciali) ──
  console.log("\nT17 verify fail-closed (limiter i padisponueshëm):");
  {
    const authorize = authorizeOf("verify-login");
    const req = { headers: { "x-forwarded-for": "9.9.9.9" } };
    const u = await makeUnverifiedOwner(`t17${SUF}`);
    const { token } = await issueVerification(u.id);

    // Rate-limit direkt: me tabelën të rënë, failOpen=false → false, failOpen=true → true.
    await prisma.$executeRawUnsafe('DROP TABLE "RateLimit"');
    try {
      ok("rateLimit failOpen=false → false", (await rateLimit("test:fc", 3, 60_000, { failOpen: false })) === false);
      ok("rateLimit failOpen=true → true", (await rateLimit("test:fo", 3, 60_000, { failOpen: true })) === true);

      // Verifikimi REFUZOHET (rate_limited) dhe kredenciali NUK konsumohet.
      let msg = "";
      try { await authorize({ token }, req); } catch (e: any) { msg = e.message; }
      ok("verify → throw rate_limited", msg === "rate_limited", `=${msg}`);
      const rec = await prisma.emailVerification.findUnique({ where: { userId: u.id } });
      ok("kredenciali s'u konsumua (used=false)", rec?.used === false);
      ok("user s'u verifikua", (await prisma.user.findUnique({ where: { id: u.id } }))?.emailVerified === false);
      ok("s'u krijua restaurant", (await restaurantCount(u.id)) === 0);
    } finally {
      // Rikrijo tabelën (siç te migrimi).
      await prisma.$executeRawUnsafe(
        'CREATE TABLE "RateLimit" ("key" TEXT NOT NULL, "count" INTEGER NOT NULL, "resetAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key"))'
      );
      await prisma.$executeRawUnsafe('CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt")');
    }

    // Pas rikthimit të limiter-it, kredenciali ende i vlefshëm verifikon normalisht.
    const after = await authorize({ token }, req);
    ok("pas rikthimit → verifikon (auto-login)", !!after && after.id === u.id);
    ok("tani u krijua restaurant", (await restaurantCount(u.id)) === 1);
  }

  await cleanup();
  console.log(`\n──────── RESULT: ${pass} passed, ${fail} failed ────────`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("FATAL", e);
  await prisma.$disconnect();
  process.exit(1);
});
