# Status i Implementimit — Verifikim i Detyrueshëm i Email-it

_Përditësuar: 2026-10-23 · Branch: `main-wes312`_

## Përmbledhje

Regjistrimi tani **kërkon verifikim email-i** para se llogaria të aktivizohet.
Përdoruesi merr njëkohësisht një **link të klikueshëm** dhe një **kod 6-shifror**
te i njëjti rekord; përdorimi i njërit çaktivizon tjetrin. **Restaurant-i dhe
trial-i krijohen VETËM pas verifikimit**, atomikisht. Google dhe përdoruesit
ekzistues trajtohen veçmas (shih më poshtë).

---

## Rrjedha

```
/register ──POST /api/register──▶ krijon User (emailVerified=false, pendingRestaurantName)
                                   + EmailVerification (tokenHash, codeHash, +1h)
                                   dërgon email (link + kod); PA auto-login
        └─▶ redirect /register/check-email?email=…  (buton "Ridërgo")

Email ─▶ link  /verify-email?token=…   (GET shfaq VETËM buton; s'konsumon)
            └─ klik ──signIn("verify-login",{token})──▶ konsumim atomik ─▶ /dashboard
     ─▶ kod   /verify-email  (formular email + kod)
            └─ submit ─signIn("verify-login",{email,code})─▶ konsumim atomik ─▶ /dashboard
```

Konsumimi (për të dyja rrugët), brenda një transaksioni të vetëm:
`CAS used:false→true` → `user.emailVerified=true` → `ensureRestaurantWithTrial`.

---

## Skedarët

**Të rinj**
- `prisma/migrations/20261023000000_email_verification/migration.sql` — migrimi
- `src/lib/email-verification.ts` — `issueVerification`, `consumeVerification`, hash-im, kufij
- `src/lib/restaurant.ts` — `ensureRestaurantWithTrial` (idempotent; ripërdoret te verifikimi DHE te onboarding)
- `src/app/api/resend-verification/route.ts` — ridërgim me rate-limit
- `src/app/register/check-email/` — faqja pas regjistrimit
- `src/app/verify-email/` — faqja e verifikimit (rruga link + rruga kod)

**Të ndryshuar**
- `prisma/schema.prisma` — `User.emailVerified`, `User.pendingRestaurantName`, modeli `EmailVerification`
- `src/lib/auth.ts` — gate server-side në login; provider `verify-login`; Google `email_verified===true` + linking; `emailVerified` te jwt/session
- `src/lib/email.ts` — `sendVerificationEmail(to, verifyLink, code)`
- `src/app/api/register/route.ts` — krijon vetëm User + verifikim, dërgon email, PA restaurant/login
- `src/app/api/onboarding/route.ts` — ripërdor helper-in
- `src/app/register/page.tsx`, `src/app/login/page.tsx` — rrjedha e re e UI-t
- `src/middleware.ts` — gate verifikimi (mbrojtje në thellësi)
- `src/types/next-auth.d.ts` — `emailVerified` te Session/JWT

---

## Vendime sigurie

| Kërkesë | Zgjidhje |
|---|---|
| Ruajtje e hash-uar | `tokenHash` = SHA-256 (token 32-byte, entropi e lartë); `codeHash` = bcrypt (kod 6-shifror) |
| Kodi jo global unik | Pa constraint unik mbi kodin; kërkohet me `userId`, krahasohet me bcrypt |
| Afat | 1 orë (`expiresAt`) |
| Kufi tentativash | `MAX_CODE_ATTEMPTS=5` për kodin; lock → kërkohet ridërgim |
| Rate limit | regjistrim 5/orë/IP; ridërgim 3/orë/IP **dhe** 3/orë/email |
| Ridërgimi invalidon të vjetrin | `upsert` mbi `userId` unik → token/kod/attempts/afat të reja |
| GET s'konsumon | Linku hap faqe me **buton**; konsumimi bëhet vetëm nga POST i përdoruesit (mbron nga prefetch i skanerëve) |
| Atomik / concurrency | `updateMany(used:false→true)` CAS brenda `$transaction` → vetëm 1 kërkesë fiton; asnjë dublim restaurant/trial |
| Gate në server | `authorize` hedh `EMAIL_NOT_VERIFIED` para se të japë sesion (jo vetëm middleware) |
| Google | Lejohet VETËM me `profile.email_verified === true` (undefined/false → refuzohet); linkon/verifikon një llogari ekzistuese të paverifikuar |

---

## Migrimi (për shqyrtim)

`prisma/migrations/20261023000000_email_verification/migration.sql`:
- `ALTER TABLE "User"` → shton `emailVerified` (default false) dhe `pendingRestaurantName`
- `CREATE TABLE "EmailVerification"` → `userId` unik, `tokenHash` unik, `codeHash`, `attempts`, `expiresAt`, `used`
- **Backfill (grandfather):**
  ```sql
  UPDATE "User" SET "emailVerified" = true WHERE "createdAt" < TIMESTAMP '2026-10-23 00:00:00';
  ```
  Filtri sipas `createdAt` grandfather-on përdoruesit EKZISTUES (p.sh. `admin@onlinemenu.al`,
  `lori@gmail.com`) por **NUK** verifikon regjistrime të reja (të krijuara pas datës së migrimit).
  Mos e hiq filtrin: një UPDATE pa filtër do të verifikonte edhe regjistrime të paverifikuara
  nëse migrimi do të ri-ekzekutohej.

---

## Teste të ekzekutuara (Postgres 16 i izoluar, lokal — JO Neon)

**Suita e logjikës — 42/42 kaluan:**

| Grup | Mbulon | Rezultat |
|---|---|---|
| Link happy path | consume me token → verified + 1 restaurant + 1 trial; slug nga pendingRestaurantName | ✅ |
| Replay | token i përdorur → `expired`; mbetet 1 restaurant | ✅ |
| Code happy path | consume me email+kod → verified + 1 restaurant + 1 trial | ✅ |
| Wrong code + lock | 5 tentativa → `wrong_code`×4 → `locked`; s'krijohet restaurant | ✅ |
| Skadim | token/kod i skaduar → `expired` | ✅ |
| Resend invalidon | token i vjetër → `invalid`; i ri → `ok`; 1 rekord/user | ✅ |
| Concurrency (token‖token) | saktësisht 1 `ok`, 1 restaurant, 1 trial | ✅ |
| Concurrency (token‖kod) | saktësisht 1 `ok`, 1 restaurant, 1 trial | ✅ |
| Login gate | i paverifikuar → throw `EMAIL_NOT_VERIFIED`; password gabim → `null`; i verifikuar → user | ✅ |
| Google | `true`→lejon+krijon verified; `false`/undefined→refuzon; linking verifikon llogari ekzistuese | ✅ |
| Idempotencë restaurant | thirrje e dytë `created=false`; 1 restaurant | ✅ |

**Backfill (SQL i drejtpërdrejtë):** user para cutoff → `true`; regjistrim i ri i paverifikuar → mbetet `false`. ✅

**Build & tipe:** `tsc --noEmit` pa gabime; `next build` kalon (route-t e reja: `/api/resend-verification`, `/register/check-email`, `/verify-email`).

**Mobile 375px (Playwright/Chromium):** 0 faqe me overflow horizontal; butonat kryesorë ≥44px (`min-h-11`). Ekrane: `register`, `check-email`, `verify-link`, `verify-code`, `login`.

> Asnjë email real nuk u dërgua; testimi përdori funksionet e librarisë (kthejnë token/kod të papërpunuar) — pa thirrje ndaj Resend.

---

## ⚠️ KUFIZIME / VEPRIME PARA PRODHIMIT

1. **Push-i mund të shkaktojë migrim LIVE në Neon.** Build-i i Vercel-it ekzekuton
   `prisma migrate deploy && next build` (shih `package.json`). Nëse Vercel e
   auto-deploy-on `main-wes312` me të njëjtat env vars të prodhimit, push-i i këtij
   branch-i do ta **aplikojë migrimin te Neon live**. Izolimi s'garantohet nga këtu,
   ndaj **commit-et janë LOKALE — nuk u bë push.** Para push-it, zgjidh njërën:
   - Çaktivizo deploy-in e këtij branch-i në Vercel (ose "Ignored Build Step"), ose
   - Përdor një DATABASE_URL/DIRECT_URL të ndryshëm për Preview, ose
   - Aplikoje migrimin manualisht te Neon (`prisma migrate deploy` me `DIRECT_URL`)
     kur të vendosësh, dhe bëj push vetëm kur deploy-i të jetë i sigurt.

2. **Resend test mode:** me `onboarding@resend.dev`, email-et shkojnë VETËM te
   `loribzhetaj1@gmail.com` derisa domain-i `onlinemenu.al` të verifikohet në Resend.

3. **Rate limit in-memory:** `src/lib/rate-limit.ts` është per-instancë (jo i fortë në
   serverless). Faza tjetër: Upstash/Redis për limit të shpërndarë.

4. **Secrets (mjedisi cloud):** për build/test live duhen `DATABASE_URL`, `DIRECT_URL`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET`. (Vlerat janë te Vercel; s'u vendosën këtu.)

5. **Lockfile:** `package-lock.json` ishte paksa jashtë sinkronie (mungonin `@emnapi/*`),
   ndaj `npm ci` dështon; u përdor `npm install` për testim dhe `package-lock.json` u
   rikthye që ky commit të mbetet i fokusuar. Rregullimi i lockfile-it mbetet veçmas.
