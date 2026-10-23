# Status i Implementimit — OnlineMenu

_Përditësuar: 2026-10-23 · Branch: `main-wes312` · (commit-e lokale, pa push)_

Dokumenti kryesor i statusit. Referenca:
- Masterplan: `docs/OnlineMenu-Plan-Arkitekture-Prompte.md`
- Baseline (Faza 0): `docs/architecture/baseline.md`
- Vendime: `docs/architecture/decisions.md`
- Plani i Fazës 1: `docs/architecture/phase-1-spec-and-plan.md`
- Mockup-et e miratuar: `docs/design/*.png`

---

## Ku jemi

| Pjesa | Status |
|---|---|
| Verifikim i detyrueshëm i email-it (link + kod) | ✅ i plotë + i forcuar; **lokal, pa push** |
| Faza 0 — baseline & spec i zbatueshëm | ✅ i dokumentuar sipas kodit aktual |
| Faza 1 — tenant/rol/entitlement | 📋 spec + plan teknik gati **për review** (pa implementim) |
| Booking (Faza 4) | ⛔ jo i nisur; repo `restorant` jashtë scope-it të sesionit |

---

## 1. Verifikimi i email-it — përmbledhje

Regjistrimi kërkon verifikim para aktivizimit; link (tokenHash SHA-256) + kod 6-shifror (bcrypt) te një rekord me `version`; Restaurant+trial krijohen vetëm pas verifikimit, atomikisht. Detajet e plota te seksionet më poshtë dhe te commit-et `b1b32d6`, `478d9a4` + forcimet e fundit.

### Kontrollet e fundit (ky raund)
- **Re-registration "latest-wins" atomik:** ndryshimi i password-it + ri-lëshimi i kredencialit bëhen në **një transaksion** (`createPendingRegistration`). Një link/kod i vjetër s'mund të verifikojë një password të vendosur nga një kërkesë tjetër. _Test: T16._
- **Fail-open/fail-closed i dokumentuar:** `rateLimit` merr `failOpen`. **Verify = fail-CLOSED** — kur limiter-i s'arrihet, verifikimi refuzohet (`rate_limited`) **pa e konsumuar kredencialin**. Register/resend/forgot = fail-open (disponueshmëri); kjo s'e dobëson kufirin e tentativave, sepse kur limiter-i bie, verifikimi (dhe çdo guess) bllokohet tërësisht. _Test: T17._

### Vendime sigurie (plot)
hash token+kod · afat 1h · lock pas 5 tentativash (increment atomik) · rate-limit PG i përbashkët (register/resend/verify/forgot) · ridërgim invalidon të vjetrin (`version++`) · GET s'konsumon (POST verifikon) · CAS `{id, version, used:false, expiresAt>now}` në `$transaction` (asnjë dublim/konsumim i pjesshëm) · login i paverifikuar bllokohet në server · Google vetëm `email_verified===true` + linking i sigurt që **heq password-in** e pabesueshëm · backfill i kufizuar (owns-restaurant ose SUPER_ADMIN).

### Teste — **76/76** (Postgres i izoluar lokal)
`npm test` (shih `tests/README.md`; guard refuzon DB jo-lokale). Mbulon: happy link/kod, replay, skadim, lock, resend+version, concurrency (token‖token, token‖code, verify‖resend), version-guard, tentativa paralele, rollback transaksioni, login gate, Google gating+linking, backfill, rate-limit, **re-registration atomik (T16)**, **verify fail-closed (T17)**. Plus `tsc` ✅, `npm ci` i pastër ✅, `next build` ✅ (pa migrim).

---

## 2. Migrimi (për shqyrtim) — `prisma/migrations/20261023000000_email_verification`
`ALTER "User"` (emailVerified, pendingRestaurantName) · `CREATE "EmailVerification"` (tokenHash, codeHash, attempts, version, …) · `CREATE "RateLimit"` · backfill i kufizuar. **Pamje paraprake PARA aplikimit:**
```sql
SELECT id, email, role FROM "User"
WHERE "emailVerified" = false
  AND ("role" = 'SUPER_ADMIN' OR "id" IN (SELECT "ownerId" FROM "Restaurant"));
```

---

## 3. Izolimi i Preview + push — status dhe hapat që mungojnë

**E verifikuar në këtë sesion:**
- `build = next build` (ndarë nga migrimi) → **build/preview nuk ekzekuton `migrate deploy`**.
- Build-i **nuk lidhet me DB** (route-t janë dinamike; s'ka query në build). Provuar me DB lokale.

**NUK mjafton heqja e `migrate deploy` nga build** — izolimi i vërtetë kërkon që **runtime-i i Preview** të mos prekë DB-në live. Hapa konkretë që i mbeten operatorit (Vercel — s'kam akses t'i verifikoj nga këtu):

1. **DB zhvillimi e izoluar:** krijo një Neon branch/DB të veçantë (jo prod). Vendos `DATABASE_URL` + `DIRECT_URL` **të scope-uar vetëm për Preview** te Vercel → Settings → Environment Variables (Environment = Preview). Prod mban variablat e veta (Environment = Production).
2. **Runtime:** sigurohu që deployment-et Preview përdorin ato variabla Preview (jo prod). Kontroll: hap një Preview, provo regjistrim/verifikim → duhet të shkruajë te DB e dev, jo prod.
3. **Migrimet:** apliko skemën te DB e dev me `npm run db:deploy` (me `DIRECT_URL` të dev) — jo nga build-i.
4. **Cron:** `vercel.json` ka `check-subscriptions`. Vercel Cron ekzekuton në **Production** (jo Preview). Verifiko që cron-i prod ka `CRON_SECRET` dhe se nuk ka cron që godet DB-në e gabuar.
5. **Email:** në Preview/dev përdor Resend **test mode** (dërgon vetëm te adresa e verifikuar) ose një sink testimi; mos dërgo email real te përdorues realë gjatë testimit.
6. **Secrets Preview:** `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (= URL-ja e Preview), `NEXT_PUBLIC_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET`, `CRON_SECRET`, Cloudinary — të scope-uar për Preview.

**Vendim push-i:** meqë **s'mund ta verifikoj izolimin e Preview nga këtu** (pa akses te Vercel) dhe migrimi s'është aplikuar në asnjë DB të arritshme, **nuk bëj push** (do krijonte një Preview që pret skemën e re; nëse Preview-ja godet prod, prek të dhëna live). Commit-et mbeten **lokale**, me **bundle të rikuperueshëm të dërguar**. Sapo të konfirmosh hapat 1–2 (Preview → DB e izoluar), bëj push te `main-wes312` dhe hap **draft PR** (pa merge në main, pa deploy prod).

---

## 4. Runbook deploy (kur të vendosësh)
1. Shqyrto backfill-in me query-n e pamjes paraprake kundrejt DB-së së synuar.
2. Apliko migrimin qëllimisht (jashtë build-it): `DATABASE_URL=<…> DIRECT_URL=<direct> npm run db:deploy`.
3. Pastaj push/deploy i kodit (kodi i ri pret skemën e re).
4. Vendos secrets-et te mjedisi përkatës.

---

## 5. Hapi pasues
- Review i këtij statusi + `phase-1-spec-and-plan.md`.
- Pas miratimit: implemento Fazën 1 (test-first), pa prekur booking-un.
- **Nuk** niset Faza 1 ose bashkimi me booking-un pa miratim.

## 6. Kufizime
- Pa push, pa migrim live, pa secrets prod, pa email real (sipas kërkesës).
- Resend test mode derisa `onlinemenu.al` të verifikohet në Resend.
- Rate-limit fail-open për register/resend/forgot (verify fail-closed); prune te cron-i ditor.
- Residual re-registration: para verifikimit, password-i i fundit fiton; aktivizimi kërkon kontroll inbox-i; pa asete para verifikimit.
