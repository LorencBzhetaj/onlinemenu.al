# RELEASE-READINESS — OnlineMenu.al (Faza 8)

_Kontroll përfundimtar para release-it. Një raund verifikimi; pa cikle të përsëritura auditimi._

**Data:** 2026-10-31 · **Branch:** `main-wes312` · **Baza:** Faza 7 (`b5263e1`) + rregullimet e Fazës 8
**Mjedisi i verifikimit:** PostgreSQL 16 LOKAL (port 5433), i izoluar nga prod/Neon.

---

## VENDIMI

| Fusha | Gjendja |
|---|---|
| **Kodi + verifikimi lokal** | ✅ **READY** |
| **Deploy-i në staging/Preview dhe verifikimet në hosting** | ⛔ **BLOCKED** — kërkon veprime të pronarit (akses Vercel/Neon/DNS) |

**Përmbledhje:** Baza e kodit është gati për release sipas të gjitha kritereve të verifikueshme
lokalisht (autorizim, izolim tenant, token/ftesa, konkurrencë booking-u, audit atomik, migrime,
backup/restore, teste të riprodhueshme, QA mobile/desktop). **Release-i aktual në staging mbetet i
bllokuar** vetëm te hapat që kërkojnë akses të ri (provizionim DB staging në Neon, vendosje sekretesh
në Vercel, deploy, verifikim i cron-it në hosting, verifikim DNS i email-it). Këto hapa nuk u kryen me
qëllim: kërkesa ndalon push/deploy/migrime live/email real.

---

## 1. Probleme konkrete të gjetura dhe të rregulluara

### 1.1 Atomiciteti i AuditLog me mutacionin kritik ✅ (rregulluar + test rollback)

**Problemi:** audit-i për mutacione kritike (ftesa, role, abonime, module) shkruhej jashtë
transaksionit të veprimit ose me një `recordAudit` best-effort që e **kapte** gabimin edhe brenda
një `$transaction` — pra një veprim mund të kryhej pa gjurmë audit-i (ose anasjelltas).

**Rregullimi:**
- Shtuar `recordAuditTx(tx, input)` (`src/modules/admin/audit.ts`) që **nuk** e kap gabimin → çdo
  dështim i audit-it rrëzon të gjithë transaksionin. `recordAudit` (best-effort) mbetet vetëm për
  regjistrime jo-kritike.
- Mbështjellë në NJË `$transaction` (veprim + audit) të gjitha rrugët kritike:
  `createInvitation`, `acceptInvitation`, `revokeMembership`, `revokeInvitation`
  (`src/modules/memberships/invitations.ts`), aktivizimi/çaktivizimi i modulit
  (`api/admin/restaurants/[id]/modules`) dhe përditësimi/rinovimi i abonimit
  (`api/admin/restaurants/[id]/subscription`). `setModuleStatus` pranon tani një klient transaksioni.

**Test rollback** (`tests/phase8.test.ts`, 14/14 ✅):
- (a) dështimi i audit-it brenda tx → veprimi RRËZOHET (roli mbetet i pandryshuar; asnjë audit jetim);
- (b) dështimi i veprimit pas audit-it → audit-i RRËZOHET (asnjë rresht jetim);
- (c/d) rrugët pozitive: ftesë/pranim/revokim shkruajnë veprimin + audit-in SË BASHKU.

### 1.2 Worker-i i njoftimeve nuk ishte i planifikuar në hosting ✅ (rregulluar)

**Problemi:** `vercel.json` planifikonte vetëm `check-subscriptions`; `/api/cron/notifications`
ekzistonte dhe ishte i mbrojtur me `CRON_SECRET`, por **nuk thirrej kurrë** nga Vercel → konfirmimet
dhe kujtesat do mbeteshin në radhë pa u dërguar.

**Rregullimi:** shtuar cron-i `/api/cron/notifications` (çdo 5 min) te `vercel.json`.
(Kujdes hosting: cron-et nën-ditore kërkojnë plan Vercel që i lejon; shih §4.)

### 1.3 Njoftimet gjithmonë "simuloheshin" + mungonte email-sink për staging ✅ (rregulluar)

**Problemi:** `/api/cron/notifications` thërriste `runNotificationWorker()` pa dërgues → përdorte
gjithmonë `simulateSender`, pra **asnjë email real nuk dërgohej kurrë**, as në prod. Njëkohësisht
s'kishte mënyrë të sigurt që staging-u të mos u dërgonte email mysafirëve realë.

**Rregullimi** (`src/modules/booking/notifications.ts`):
- Shtuar `resendSender` (Resend, si `lib/email.ts`) dhe `defaultNotificationSender()`.
- Dërgimi LIVE është **OPT-IN eksplicit**: vetëm me `EMAIL_SEND_LIVE=1` + `RESEND_API_KEY` real.
  Kudo tjetër (staging/Preview/CI/lokal) → `simulateSender` si **email sink** (job-et përpunohen e
  shënohen `Simulated`, pa dërgime reale). Cron-i tani e përdor `defaultNotificationSender()`.

### 1.4 Indeksimi i staging/Preview ✅ (rregulluar)

**Problemi:** `robots.ts` lejonte gjithmonë `/` → një deployment staging do indeksohej nga Google.

**Rregullimi:** `indexingAllowed()` (`src/lib/site.ts`) + `robots.ts` bën `disallow: "/"` dhe
`layout.tsx` shton meta `noindex` kur `NOINDEX=1` ose `VERCEL_ENV≠production`.

### 1.5 Path-e absolute të Playwright/Chromium ✅ (rregulluar — shih §2)

---

## 2. Teste të riprodhueshme

- **Path-et absolute u hoqën:** 6 skedarë e2e importonin Playwright nga `/opt/node-tools/...` dhe
  Chromium nga `/opt/pw-browsers/...`. Tani përdorin helper-in `tests/e2e/_browser.ts` që importon
  paketën `playwright` dhe nis shfletuesin me default-in e menaxhuar nga Playwright, me override
  opsional `PLAYWRIGHT_EXECUTABLE_PATH` (për container me Chromium të para-instaluar).
- **Varësia e deklaruar:** `playwright@1.63.0` te `devDependencies` + `package-lock.json` i përditësuar.
  `npm ci --dry-run` → RC=0 (grafi i varësive konsistent, instalohet pastër në makinë tjetër).
- **Dokumentim:** `tests/README.md` përditësuar (setup i riprodhueshëm, env var, phase8, teste migrimesh).

### Migrime — provuar në të dyja gjendjet

| Skenar | Rezultat |
|---|---|
| **DB bosh** → `db:deploy:test` (10 migrime) | ✅ të gjitha aplikohen; paritet me `schema.prisma` = "No difference detected" |
| **Skemë e vjetër (deri Faza 5) → HEAD** | ✅ P6+P7 aplikohen; të dhënat ekzistuese (restorant+membership) mbijetojnë; kolonat e reja `city/cuisine` = NULL (aditive); paritet "No difference" |

Migrimet e P6/P7 janë **aditive** (kolona/tabela/indekse të reja) → pa humbje të dhënash, pa rishkrim.

---

## 3. Rikuperim — backup & restore real

- **Verifikuar:** `pg_dump` (format custom) → `pg_restore` në DB të re → krahasim rresht-për-rresht i
  **37 tabelave**: 24/24 rreshta, **0 mospërputhje**; restoranti + audit-i i mbjellë të paprekur.
- **Runbook i shtuar:** `scripts/db-backup.sh` dhe `scripts/db-restore.sh` (restore-i refuzon DB jo-bosh
  pa `FORCE=1`). Të dyja të provuara (përfshi guard-in).
- **E rëndësishme:** `git bundle` ruan vetëm KODIN, jo të dhënat e DB-së. Rikuperimi i të dhënave
  kërkon këtë backup. Testo restore-in periodikisht (jo vetëm dump-in).

---

## 4. Staging/Preview — konfigurim

Të gjitha të dokumentuara te `.env.example` (seksioni staging) dhe të verifikuara lokalisht:

| Element | Gjendja | Shënim |
|---|---|---|
| DB e izoluar | ✅ konfigurim i dokumentuar | projekt/branch Neon i ndarë nga prod; migrime vetëm aty |
| Sekrete të ndara | ✅ dokumentuar | `NEXTAUTH_SECRET`, `CRON_SECRET` të ndara për staging |
| Email test sink | ✅ implementuar + verifikuar | `EMAIL_SEND_LIVE` bosh → simulim; worker-i: job → `Simulated`, pa email real |
| Cron/worker i kontrolluar | ✅ konfig + logjikë e verifikuar | `vercel.json` (2 cron) + auth `CRON_SECRET`; worker: claim atomik, lease, retry→Dead |
| URL + indeksim | ✅ verifikuar | `NOINDEX=1`/`VERCEL_ENV` → robots disallow all + meta noindex |

### ⛔ Çfarë mbetet E PAVERIFIKUAR (kërkon akses — nuk u krye me qëllim)

1. **Cron-i i njoftimeve në hosting-un real:** logjika e worker-it + oraret + auth-i u verifikuan
   lokalisht (job → `Simulated`), por **thirrja reale e `/api/cron/notifications` nga Vercel Cron** nuk u
   provua — kërkon deploy. Kujdes: cron-et nën-ditore (`*/5`) kërkojnë plan Vercel që i lejon (Pro+); në
   Hobby përdor një scheduler të jashtëm që godet endpoint-in me të njëjtin `Bearer <CRON_SECRET>`.
2. **Dërgimi real i email-it (Resend):** kërkon `EMAIL_SEND_LIVE=1` + çelës real + DNS i verifikuar për
   `onlinemenu.al` (`EMAIL_FROM` ende `onboarding@resend.dev`). Nuk u provua (pa email real).
3. **Provizionimi i DB staging në Neon + sekretet në Vercel:** kërkon akses në dashboard-et përkatëse.
4. **Pilot me restorant të ri në sistemin e ri:** kërkon deploy (jashtë këtij raundi).
5. **Gjeçaj:** i paprekur — mbetet në booking-un ekzistues; cutover-i trajtohet si projekt i veçantë.

---

## 5. Review i rrugëve kritike (pa ndryshime të nevojshme — të shëndosha)

- **Autorizim + izolim tenant:** `resolveAccess` rilexon membership-in NGA DB (jo JWT), `restaurantId`
  jepet shprehimisht (header/`?r`), allowlist deny-by-default (`permissions.ts`). `team:read/write` vetëm OWNER.
- **Token/ftesa:** token RAW 32-byte, në DB vetëm SHA-256; konsumim njëpërdorimësh atomik
  (`updateMany` i guard-uar, count===1); përputhje email case-insensitive; invariant OWNER (ftesa s'krijon
  OWNER; revokimi s'lë restorantin pa OWNER aktiv).
- **Konkurrencë booking-u:** `pg_advisory_xact_lock` per-slot (çelës me prefiks `restaurantId`), assignment
  i sigurt + kontroll kapaciteti në transaksion, idempotencë (P2002 → kthen fituesin), `findOrCreateCustomer`
  race-safe. Njoftimet + `booking_created` enqueue-ohen në TË NJËJTIN tx.
- **Njoftime:** job në tx (dedupe unik), worker me claim atomik + lease + backoff + dead-letter; dështimi i
  email-it nuk anulon rezervimin.

---

## 6. Prova — komanda & rezultate

```
tsc --noEmit                         → 0 gabime
npm test (unit/integration)          → 319 passed, 0 failed
  verification 76 · phase1 49 · phase3 41 · phase4 43 · phase5 23 · phase6 30 · phase7 43 · phase8 14
npm run test:e2e (server + Chromium) → 94 passed, 0 failed, 0 overflow @390/1440
  phase1 19 · phase3 23 · phase5 15 · phase6 23 · phase7 14
migrime: DB bosh + skemë e vjetër    → paritet "No difference detected" (të dyja)
backup/restore                       → 37 tabela, 24/24 rreshta, 0 mospërputhje
npm ci --dry-run                     → RC=0 (lock konsistent)
```

**Screenshots (390 + 1440):** zbulim/kërkim (`home`, `search`, `search-availability`), profil→menu→rezervim
(`profile`, `menu`, `reserve`, `booking`), ekip/analitikë/audit (`team`, `analytics`, `audit`).
Overflow horizontal: 0 në të gjitha.

---

## 7. Runbook i staging-ut (pronari — kërkon akses)

### 7.0 Git/Vercel — gjendja (S1)

- Remote `origin` = `github.com/LorencBzhetaj/onlinemenu.al`. `origin/main`, `origin/main-wes312` dhe
  `main` lokal janë **të gjitha te `94b6b19`** (WIP i vjetër para Fazës 1). Të 17 commit-et e Fazave 1–8
  janë **vetëm lokale**.
- Një push i `main-wes312` do ishte **fast-forward i pastër** (pa divergjencë, pa force).
- **Auto-deploy — KËRKON AKSES (dashboard Vercel):** sjellja default e Vercel është që çdo push te një
  degë jo-prod krijon një **Preview deployment** automatikisht. RREZIKU i izolimit: nëse variablat e DB
  janë caktuar për "All Environments" (ose vetëm Production pa Preview), Preview-i mund të godasë DB-në e
  **prodhimit**. **Prandaj push-i mbetet i bllokuar derisa të konfirmohet** (pika 7.1).

### 7.1 Gate para autorizimit të push-it (pronari verifikon në Vercel)

1. Vercel → Project → Settings → Git: cila është **Production Branch** (pritet `main`), dhe a janë
   **Preview Deployments** aktive për degët.
2. Vercel → Settings → Environment Variables: sigurohu që `DATABASE_URL`/`DIRECT_URL` për **Preview** të
   tregojnë te një **DB staging e izoluar**, JO prod. Nëse ndonjë ndryshore e DB është "All Environments"
   me vlerë prod → **ndaje**: Production = prod, Preview = staging.
3. Cakto për **Preview**: `NEXTAUTH_SECRET`/`CRON_SECRET` të reja, `NEXT_PUBLIC_BASE_URL`/`NEXTAUTH_URL` =
   domaini Preview/staging, `NOINDEX=1`, `EMAIL_SEND_LIVE` bosh (sink).

### 7.2 DB staging + migrime + të dhëna demo

```bash
# Migrime vetëm te DB staging (kurrë prod):
DATABASE_URL=<staging> DIRECT_URL=<staging> npm run db:deploy
# Të dhëna sintetike demo (A/B restorante, booking aktiv, orare):
STAGING_SEED=1 DATABASE_URL=<staging> DIRECT_URL=<staging> npx tsx scripts/seed-staging.ts
```

### 7.3 Deploy staging + verifikim (smoke)

Pas deploy-it në staging, ekzekuto smoke-test-in (HTTP + browser, pa akses DB):

```bash
STAGING_BASE_URL=https://<staging> CRON_SECRET=<staging-cron> \
  npx tsx tests/e2e/staging-smoke.ts
```

Kontrollon: noindex (robots disallow all), cron 401/200, rrjedhën **rezervim → anulim**, dhe përpunimin e
njoftimeve nga cron-i. _(I verifikuar lokalisht 8/8 kundrejt një serveri staging-like.)_
Kujdes hosting: cron-et nën-ditore kërkojnë plan Vercel që i lejon (Pro+); në Hobby përdor një scheduler të
jashtëm që godet `/api/cron/notifications` me `Authorization: Bearer <CRON_SECRET>`.

### 7.4 Backup/restore + prod

```bash
DATABASE_URL=<staging> scripts/db-backup.sh ./backups      # para çdo ndryshimi të rrezikshëm
scripts/db-restore.sh <dump> <target-bosh>                 # rikuperim (refuzon DB jo-bosh pa FORCE=1)
```

- Për prod: verifiko DNS-në e Resend, vendos `EMAIL_FROM` zyrtar + `EMAIL_SEND_LIVE=1`.
- Pilot me një restorant të ri; **Gjeçaj mbetet në sistemin ekzistues** derisa cutover-i të planifikohet.

> **Kufiri "pa push/deploy" mbetet** derisa të verifikohet 7.1 dhe të autorizosh publikimin në staging.
