# Teste

`verification.test.ts` — mbulim i verifikimit të email-it dhe rate-limit-it, i
riprodhueshëm kundrejt një **PostgreSQL lokal testimi** (kurrë Neon/prodhim).

## Mbrojtja e DB-së

Skripti **refuzon të niset** nëse `DATABASE_URL` nuk duket lokale (`localhost`/
`127.0.0.1`) ose duket remote (`neon.tech`, `amazonaws`, `supabase`, `.cloud`),
sepse pastron të dhëna (`deleteMany`). Kështu testet s'prekin dot prodhimin.
Të dhënat test përdorin suffix-in `@test.local` dhe çelësa rate-limit `test:…`;
pastrohen para dhe pas çdo ekzekutimi.

Anashkalim me vetëdije (jo i rekomanduar): `ALLOW_NONLOCAL_TEST_DB=1`.

## Setup i DB-së lokale (një herë)

PostgreSQL duhet të ekzekutohet nga një përdorues jo-root (p.sh. `postgres`):

```bash
export PATH="/usr/lib/postgresql/16/bin:$PATH"
BASE=/tmp/omtest
runuser -u postgres -- initdb -D "$BASE/pgdata" -U postgres --auth=trust -E UTF8
runuser -u postgres -- pg_ctl -D "$BASE/pgdata" -o "-p 5433 -c listen_addresses=127.0.0.1" -l "$BASE/pg.log" start
psql "postgresql://postgres@127.0.0.1:5433/postgres" -c "CREATE DATABASE onlinemenu_test;"
```

Apliko skemën (migrime) me komandën e GUARD-uar — kontrollon që DATABASE_URL **dhe**
DIRECT_URL janë lokale PARA `migrate deploy` (migrate deploy përdor DIRECT_URL):

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/onlinemenu_test"
export DIRECT_URL="$DATABASE_URL"
npm run db:deploy:test   # = require-local-db guard + prisma migrate deploy
```

> Mos përdor `npx prisma migrate deploy` të pa-guard-uar për testim — mund të godasë prod.
> `npm run db:deploy` (pa `:test`) është VETËM për deploy-in e qëllimshëm te prod.

## Ekzekutimi

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/onlinemenu_test"
export DIRECT_URL="$DATABASE_URL"
npm test   # `pretest` ekzekuton guard-in e DB-së lokale automatikisht
```

`phase4.test.ts` — motori i rezervimeve (Faza 4), multi-tenant, kundrejt Postgres lokal.
Mbulon: izolim tenant (dy restorante; tavolinë/klient të ndarë), assignment single+kombinim,
gate orari + mbyllje restoranti/zone, slot caps, kohëzgjatje+buffer, create/cancel/reschedule
atomik, idempotencë (seri + paralele), konkurrencë (tavolinë e vetme → saktësisht një fiton),
dhe gate-in e entitlement-it BOOKING. BOOKING aktivizohet VETËM për restorantet testuese.
Rreshtat `prisma:error` gjatë testit të konkurrencës janë P2002 të pritura (racer-i humbës),
të trajtuara nga retry/re-read — jo dështime.

## E2E / HTTP (browser real, cookie sesioni)

`tests/e2e/phase1.e2e.ts` kërkon serverin NË KËMBË mbi të njëjtën DB lokale:

```bash
# Terminal 1 — ndërto dhe nis serverin (me env lokale + RESEND dummy për build)
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/onlinemenu_test"; export DIRECT_URL="$DATABASE_URL"
export NEXTAUTH_SECRET=test-secret NEXTAUTH_URL=http://localhost:3000 NEXT_PUBLIC_BASE_URL=http://localhost:3000 RESEND_API_KEY=re_dummy
npm run build && npm start

# Terminal 2 — ekzekuto E2E (Playwright + Chromium i parainstaluar)
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/onlinemenu_test"; export DIRECT_URL="$DATABASE_URL"
npm run test:e2e
```

Mbulon me cookie reale: OWNER A↔B, header x-restaurant-id i mirë/i keq/i munguar, ID objekti/parent
të tenant-it tjetër, MANAGER/STAFF/revoked, modul MENU joaktiv (route + publik), two-tab
(shkrim/lexim mbeten te A + refresh + navigation), dhe gate-i publik (isPublished+suspendedAt+MENU).

`phase5.test.ts` — njoftimet e Fazës 5 (job në tx, worker/sink, dedupe, retry→Dead, lease/
konkurrencë, email failure s'anulon booking, cancel/reschedule jobs, digest idempotent).
Dërguesi është i injektueshëm → sink testi, pa dërgime reale. Rreshtat `prisma:error` gjatë
testit të digest-it janë P2002 të pritura (idempotencë), jo dështime.

`tests/e2e/phase5.e2e.ts` (Faza 5) ekzekuton ciklin e plotë mbi serverin real: klient rezervon
(formular publik) → stafi e sheh/riplanifikon → klienti anulon; verifikon njoftimet pas commit-it,
cron-in (401 pa secret / 200 me secret) dhe bën screenshots @390/1440. Kërkon `CRON_SECRET` te env-i
i serverit (p.sh. `CRON_SECRET=test-cron`).

`tests/e2e/phase3.e2e.ts` (Faza 3) mbulon rrjedhën publike: QR `/q/[code]` → profil, alias `/m/[slug]` →
profil, profil/menu/info, lidhje Wolt (jashtme), rezervim i gated-uar (BOOKING + destinacion), kërkim
pjatash, alergjenë, disponueshmëri, orare menuje, dhe kontrolle aksesi për API-të e reja
(links/allergens: pa sesion → 401, pa header → 400, tenant tjetër → 403, URL e palejuar → 400).
Përfshin screenshots @390/1440 me kontroll overflow për profil/menu/info.

`tests/e2e/visual.ts` bën kontrollin vizual (screenshots + overflow @390/1440). Ekzekuto si E2E (server + tsx).

> **Varësi lokale Playwright (rregullo para CI/release):** `tests/e2e/*` importojnë Playwright nga
> `/opt/node-tools/node_modules/playwright` dhe Chromium nga `/opt/pw-browsers/...` — specifike e këtij
> ambienti. Para CI: shto `@playwright/test` si devDependency dhe zëvendëso path-et absolute.
> `tests/e2e` është përjashtuar nga `tsc` dhe `npm test`.

## Çfarë mbulohet

Link/kod happy path · replay · skadim · wrong-code + lock · resend invalidon +
`version++` · concurrency (token‖token, token‖code, **verify‖resend**) ·
version-guard CAS · **tentativa kodi paralele (increment atomik)** ·
**dështim transaksioni → rollback** · login gate në server · Google gating +
**linking i sigurt (heq password-in e pabesueshëm)** · idempotencë restaurant ·
**backfill i kufizuar** · **rate limit PostgreSQL (seri + concurrency)**.
