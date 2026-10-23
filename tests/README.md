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

Apliko skemën (migrime), pa prekur asnjë DB tjetër:

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/onlinemenu_test"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
```

## Ekzekutimi

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/onlinemenu_test"
export DIRECT_URL="$DATABASE_URL"
npm test
```

## Çfarë mbulohet

Link/kod happy path · replay · skadim · wrong-code + lock · resend invalidon +
`version++` · concurrency (token‖token, token‖code, **verify‖resend**) ·
version-guard CAS · **tentativa kodi paralele (increment atomik)** ·
**dështim transaksioni → rollback** · login gate në server · Google gating +
**linking i sigurt (heq password-in e pabesueshëm)** · idempotencë restaurant ·
**backfill i kufizuar** · **rate limit PostgreSQL (seri + concurrency)**.
