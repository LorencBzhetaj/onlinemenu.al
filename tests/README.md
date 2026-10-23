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

## Çfarë mbulohet

Link/kod happy path · replay · skadim · wrong-code + lock · resend invalidon +
`version++` · concurrency (token‖token, token‖code, **verify‖resend**) ·
version-guard CAS · **tentativa kodi paralele (increment atomik)** ·
**dështim transaksioni → rollback** · login gate në server · Google gating +
**linking i sigurt (heq password-in e pabesueshëm)** · idempotencë restaurant ·
**backfill i kufizuar** · **rate limit PostgreSQL (seri + concurrency)**.
