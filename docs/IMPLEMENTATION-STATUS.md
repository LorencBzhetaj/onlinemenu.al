# Status i Implementimit — Verifikim i Detyrueshëm i Email-it

_Përditësuar: 2026-10-23 · Branch: `main-wes312` · (commit-e lokale, pa push)_

## Përmbledhje

Regjistrimi **kërkon verifikim email-i** para aktivizimit. Përdoruesi merr
njëkohësisht një **link të klikueshëm** dhe një **kod 6-shifror** te i njëjti rekord;
përdorimi i njërit çaktivizon tjetrin. **Restaurant-i + trial-i krijohen VETËM pas
verifikimit**, atomikisht. Mbi versionin bazë u shtuan forcime sigurie/qëndrueshmërie
(shih seksionin "Forcimet").

---

## Rrjedha

```
/register ─POST /api/register→ krijon User (emailVerified=false, pendingRestaurantName)
                               + EmailVerification (tokenHash, codeHash, version, +1h)
                               dërgon email (link + kod); PA auto-login
        └─▶ /register/check-email?email=…  (buton "Ridërgo")

Email ─▶ link  /verify-email?token=…   (GET shfaq VETËM buton; s'konsumon)
            └ klik ─signIn("verify-login",{token})→ konsumim atomik → /dashboard
     ─▶ kod   /verify-email  (formular email + kod)
            └ submit ─signIn("verify-login",{email,code})→ konsumim atomik → /dashboard
```

Konsumimi (të dyja rrugët), brenda një transaksioni:
`CAS {id, version, used:false, expiresAt>now} → used:true` → `emailVerified=true` →
`ensureRestaurantWithTrial`.

---

## Forcimet (raundi i dytë)

| # | Kërkesa | Zgjidhja |
|---|---|---|
| 1 | Kopje e rikuperueshme pa sekrete | `git bundle` i plotë i branch-it + patch i commit-it, dërguar si file; `.env` kurrë s'është në git |
| 2 | Testet në repo + dokumentim | `tests/verification.test.ts` + `tests/README.md`; komanda `npm test`; **guard** që refuzon DB jo-lokale |
| 3 | Lockfile + `npm ci` i pastër | shtuar `@emnapi/*` që mungonin; `rm -rf node_modules && npm ci` kalon; pastaj tsc+test+build |
| 4 | Ndaj build nga `migrate deploy` | `build` = `next build`; migrimet me `npm run db:deploy` (hap i veçantë); build s'prek DB |
| 5 | Backfill i kufizuar | kriter = **zotëron Restaurant** OSE **SUPER_ADMIN** (jo cutoff date); i dokumentuar, jo i aplikuar live |
| 6 | Google linking i sigurt | verifikimi i një llogarie të paverifikuar **heq passwordHash-in** e pabesueshëm + fshin verifikimin në fluturim; re-registration mbetet "latest-wins" para verifikimit (pa asete) |
| 7 | Konsumim i lidhur me kredencialin | shtuar `version`; CAS lidhet me `{id, version}` — ri-dërgimi (version++) anulon konsumimin në fluturim |
| 8 | Rate limit i përbashkët | `RateLimit` në PostgreSQL (upsert atomik); zbatuar te register, resend, **verify** (dhe forgot-password) |

---

## Skedarët

**Të rinj:** `prisma/migrations/20261023000000_email_verification/`,
`src/lib/email-verification.ts`, `src/lib/restaurant.ts`,
`src/app/api/resend-verification/`, `src/app/register/check-email/`,
`src/app/verify-email/`, `tests/verification.test.ts`, `tests/README.md`.

**Të ndryshuar:** `prisma/schema.prisma` (+`version`, +`RateLimit`), `src/lib/auth.ts`,
`src/lib/email.ts`, `src/lib/rate-limit.ts` (→ PostgreSQL, async),
`src/app/api/register/route.ts`, `src/app/api/onboarding/route.ts`,
`src/app/api/forgot-password/route.ts`, `src/app/api/cron/check-subscriptions/route.ts`
(prune rate-limit), `src/app/register/page.tsx`, `src/app/login/page.tsx`,
`src/middleware.ts`, `src/types/next-auth.d.ts`, `package.json`.

---

## Vendime sigurie (plot)

- **Ruajtje hash:** `tokenHash`=SHA-256 (token 32-byte), `codeHash`=bcrypt (kod 6-shifror). Kodi **jo** unik global.
- **Afat** 1 orë; **lock** pas 5 tentativash kodi (increment atomik `attempts`).
- **Rate limit (PostgreSQL):** register 5/orë/IP · resend 3/orë/IP + 3/orë/email · verify 10/10min/IP · forgot 3/orë/IP. Fail-open nëse DB dështon.
- **Ridërgimi** invalidon kredencialin e vjetër (`upsert` + `version++`).
- **GET s'konsumon:** linku → faqe me buton; verifikimi është POST (mbron nga prefetch i skanerëve).
- **Atomik/concurrency:** CAS `{id, version, used:false, expiresAt>now}` brenda `$transaction` → asnjë dublim restaurant/trial, asnjë konsumim i pjesshëm (rollback i provuar).
- **Login i paverifikuar** bllokohet në server (`authorize` hedh `EMAIL_NOT_VERIFIED`).
- **Google** vetëm me `email_verified===true`; linking i një llogarie të paverifikuar **heq password-in** potencialisht të vendosur nga tjetërkush.

---

## Migrimi (për shqyrtim)

`prisma/migrations/20261023000000_email_verification/migration.sql`:
- `ALTER "User"` → `emailVerified` (default false), `pendingRestaurantName`.
- `CREATE "EmailVerification"` → `userId` unik, `tokenHash` unik, `codeHash`, `attempts`, `version`, `expiresAt`, `used`.
- `CREATE "RateLimit"` → `key` PK, `count`, `resetAt`, index mbi `resetAt`.
- **Backfill i kufizuar:**
  ```sql
  UPDATE "User" SET "emailVerified" = true
  WHERE "emailVerified" = false
    AND ("role" = 'SUPER_ADMIN' OR "id" IN (SELECT "ownerId" FROM "Restaurant"));
  ```
  Legacy = zotëron Restaurant (rrjedha e vjetër e krijonte menjëherë) ose është super-admin.
  Regjistrimet e reja (pa restaurant derisa të verifikohen) MBETEN false.

  **Pamje paraprake PARA aplikimit** (ekzekuto dhe shqyrto bashkësinë e prekur):
  ```sql
  SELECT id, email, role FROM "User"
  WHERE "emailVerified" = false
    AND ("role" = 'SUPER_ADMIN' OR "id" IN (SELECT "ownerId" FROM "Restaurant"));
  ```

---

## Teste (Postgres 16 i izoluar lokal — JO Neon · **59/59 kaluan**)

Komanda: `npm test` (shih `tests/README.md` për setup DB + guard-in që refuzon DB jo-lokale).

Mbulon: link/kod happy · replay · skadim · wrong-code+lock · resend+`version++` ·
concurrency (token‖token, token‖code, **verify‖resend**) · **version-guard CAS** ·
**tentativa kodi paralele (increment atomik)** · **dështim transaksioni → rollback** ·
login gate në server · Google gating + **linking i sigurt (heq password)** ·
idempotencë restaurant · **backfill i kufizuar** · **rate limit PostgreSQL (seri+concurrency)**.

Verifikime shtesë: `tsc --noEmit` ✅ · `npm ci` i pastër ✅ · `next build` ✅
(**s'ekzekuton `migrate deploy`**) · mobile 375px pa overflow (raundi i parë).

> Asnjë email real s'u dërgua; testet përdorin funksionet e librarisë (kthejnë token/kod të papërpunuar).

---

## Runbook për deploy (konfigurimi i nevojshëm PARA push-it)

Tani `build` s'bën më migrim, pra **push/preview build s'e prek DB-në live**. Rendi i saktë:

1. **Shqyrto backfill-in** me query-n e pamjes paraprake (më sipër) kundrejt Neon.
2. **Apliko migrimin te Neon qëllimisht**, jashtë build-it:
   ```bash
   DATABASE_URL=<neon-pooled> DIRECT_URL=<neon-direct> npm run db:deploy
   ```
   (`DIRECT_URL` = lidhja direkte, jo pooled.)
3. **Pastaj** bëj push → Vercel ndërton (vetëm `next build`) dhe publikon kodin e ri.
   Kodi i ri pret skemën e re; prandaj migrimi duhet aplikuar para/bashkë me deploy-in.
4. Vendos secrets-et e nevojshëm te Vercel (shih më poshtë).

> Alternativë: shto `db:deploy` si hap i veçantë CI/release (jo brenda `build`).

---

## Kufizime / mbetet

- **Nuk u bë push dhe nuk u aplikua asnjë migrim live** (sipas kërkesës). Commit-et janë lokale; dërguar bundle i rikuperueshëm.
- **Secrets (Vercel):** `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET`, `CRON_SECRET`. S'u vendosën këtu.
- **Resend test mode:** me `onboarding@resend.dev`, email-et shkojnë vetëm te `loribzhetaj1@gmail.com` derisa `onlinemenu.al` të verifikohet.
- **Re-registration (residual):** para verifikimit, password-i i fundit i vendosur fiton; aktivizimi kërkon kontroll të inbox-it dhe s'ka asete para verifikimit. Forcim i mundshëm i ardhshëm: mbledh password-in PAS verifikimit (zero residual).
- **Rate limit fail-open:** nëse DB-ja s'arrihet, lejohet (për disponueshmëri). Prune periodik te cron-i ditor.
