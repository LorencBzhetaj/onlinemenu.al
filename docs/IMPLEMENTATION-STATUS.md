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
| Faza 1 — tenant/rol/entitlement | ✅ **implementuar** + kontroll integrimi (E2E 19/19); **lokal, pa push/migrim live** |
| Faza 2 — design system + layout-e | ✅ **implementuar** (krem/jeshile); 0 overflow @390/1440; build OK |
| Booking (Faza 4) | ⛔ jo i nisur; repo `restorant` jashtë scope-it të sesionit |

---

## 0.1 Faza 2 — Design system + layout-e (e implementuar)

Chrome-i i platformës (publik marketing + panel + admin + auth) u kalua në temën **krem/jeshile** sipas mockup-eve (`docs/design/*.png`). Faqja publike e menusë `/m/[slug]` **ruan brendin e restorantit** (temë e vet, nuk preket).

**Tokens (Tailwind):** canvas #FAF8F3, surface #FFFFFF, ink #20241F, muted #62685F, line #E8E3D7, primary #164B36 (jeshile), accent #A77932; radii card 24/20, field 16, butona pill; hije e butë; fonte Playfair Display (tituj) + Jost (UI).

**Komponentë të përbashkët** (`src/components/ui/`): Button (variante), Card/StatCard, PageHeader, Badge/StatusBadge, EmptyState/Notice, DataTable (responsive: tabelë→karta). Plus `Modal`/`Field`/`inputClass` të përbashkët (restiluar), DashboardNav (me gjendje aktive) dhe RestaurantSwitcher.

**Referencat + zbatimi:** faqe referencë publike `/` (landing) dhe panel `/dashboard`; pastaj komponentët/temat te faqet ekzistuese — layout dashboard + admin, faqet e dashboard-it, auth (login/register/forgot/reset/verify/check-email), onboarding, admin restaurants (DataTable). Navigim: sidebar në desktop, nav horizontal në mobile.

**Ruajtur:** autorizimi/funksionaliteti i Fazës 1 (`?r`, `x-restaurant-id`, pageAccess, membership) i paprekur — testet 125/125 ende kalojnë.

**Kontroll vizual (Playwright, server real):** screenshots @**390px** dhe @**1440px** për landing, login, dashboard, menu, settings, billing, admin — **0 overflow horizontal**. `tsc` 0 · `next build` OK.

> **Varësi lokale Playwright (për rregullim para CI/release):** skriptet `tests/e2e/*` (E2E + visual) importojnë Playwright nga `/opt/node-tools/node_modules/playwright` (i pranishëm vetëm në këtë ambient) dhe Chromium nga `/opt/pw-browsers/...`. Para CI/release: shto `@playwright/test` si devDependency dhe hiqe path-in absolut (ose vendose si env). **Nuk bllokon punën vizuale**; `tests/e2e` është përjashtuar nga `tsc` dhe nga `npm test`.

---

## 0. Faza 1 — tenant context, role, entitlements (e implementuar)

Modeli i pronësisë 1:1 u shndërrua në **membership + rol + restorant aktiv** me **izolim tenant në server për çdo lexim privat dhe mutacion**, dhe **entitlement MENU/BOOKING** të ndara. Vendimet e miratimit (§2 e spec-it) janë zbatuar.

**Modulet e reja:** `src/modules/memberships/{permissions,access,active-restaurant}.ts`, `src/modules/subscriptions/entitlements.ts`, `src/modules/restaurants/provision.ts`.

**Mekanizmi i autorizimit:** `requireRestaurantAccess(action, restaurantId)` / `guardRestaurant(req, action)` rilexon membership-in nga DB; `restaurantId` vjen shprehimisht nga header-i `x-restaurant-id` (klienti përmes `useApiFetch`/`RestaurantProvider`) ose nga faqja (`pageAccess`). `hasEntitlement` me allowlist. Deny-by-default për veprime të panjohura.

### Inventari i rrugëve/faqeve të përshtatura
**API private (header + requireRestaurantAccess + entitlement për menu):** `categories[/id]`, `subcategories[/id]`, `menu-items[/id]`, `menu/reorder` (menu:write + MENU; reorder me ID të huaja → refuzim i plotë), `restaurant/branding` (branding:write), `restaurant/settings` (settings:write). **E re:** `dashboard/active-restaurant` (POST).
**Faqe (pageAccess + rol):** `/dashboard` (menu:read), `/dashboard/menu` (menu:read), `/dashboard/branding` (branding:read), `/dashboard/settings` (settings:read), `/dashboard/qr` (qr:read), `/dashboard/billing` (billing:read — OWNER). Layout-i jep `RestaurantProvider` + `RestaurantSwitcher`.
**Pa ndryshim:** `admin/*` (SUPER_ADMIN + rrugë të audituara), `onboarding` (session.user.id), publike `/m/[slug]`.
**Krijim atomik** (Restaurant+OWNER+Subscription+entitlements): `consumeVerification`, `onboarding`, `seed` (super admin tani `emailVerified=true`).

### Migrimi i Fazës 1 (për shqyrtim)
`prisma/migrations/20261024000000_phase1_memberships_entitlements` — `RestaurantMembership`, `ModuleEntitlement`, `User.activeRestaurantId`, `Restaurant.suspendedAt` + backfill i kufizuar (OWNER membership nga `ownerId`; MENU pasqyron statusin e abonimit, s'riaktivizon; BOOKING `disabled`). **Aplikuar vetëm lokal me `npm run db:deploy:test`.**

### Teste — **49/49** (`tests/phase1.test.ts`)
Cross-tenant lexim+shkrim i refuzuar · revoked private reads · rol→veprim (STAFF/MANAGER/OWNER) · action i panjohur/bad_request · tabela e entitlement-it · **cancelled-subscription backfill (s'riaktivizon)** · provisionim atomik+idempotent+**concurrency** · invariant ownerId↔OWNER · selectActiveRestaurant · **krijim pas verifikimit → membership+entitlements**.

### Kontrolli përfundimtar i integrimit (E2E/HTTP me cookie reale) — **19/19**
`npm run test:e2e` (Playwright + Chromium, server në këmbë mbi Postgres lokal; shih tests/README.md):
- OWNER A↔B: header x-restaurant-id i mirë → 201; i tenant-it tjetër → 403; i munguar → 400; ID objekti/parent i tenant-it tjetër → 403.
- MANAGER menu:write → 201 dhe billing page → "nuk ka akses"; STAFF menu:write → 403; membership i revokuar → 403.
- Modul MENU joaktiv: shkrim → 403 `MODULE_INACTIVE`; faqja publike → "jo aktive".
- **Two-tab**: hap formularin e A → kalo aktivin global te B në tab tjetër → shkrimi/leximi i tab-it të parë MBETEN te A; refresh dhe navigim e ruajnë (via `?r`).
- Publik `/m/[slug]`: respekton isPublished + suspendedAt + entitlement MENU, menjëherë (pa cache i vjetruar).

### Probleme të gjetura në këtë kontroll dhe të rregulluara
1. **Two-tab (cross-tab):** restoranti i faqes tani lidhet me URL-në `?r=<id>` (per-tab, mbijeton refresh/back/forward); `pageAccess`/`useApiFetch`/nav/switcher e respektojnë. Pa fallback të heshtur kur aktivi global ndryshon në një tab tjetër.
2. **Publik `/m/[slug]`:** hequr kontrolli paralel `isActive(subscription)`; tani përdor `hasEntitlement(MENU)` (përfshin suspendedAt + modul) + `isPublished`; faqja u bë `force-dynamic` që çaktivizimi/pezullimi të reflektohet menjëherë (pa dritare 60s cache).
3. **Seed:** (nga raundi i mëparshëm) super-admin `emailVerified=true`.

### Admin — rikontroll roli + audit
Admin routes/faqet rikontrollojnë rolin **në server** (`admin/layout.tsx` + `/api/admin/.../subscription`: `role !== "SUPER_ADMIN"` → refuzim). **Audit NUK ekziston** (s'ka model `AuditLog`); mutacionet admin nuk regjistrojnë audit. **Punë e mbetur** (Faza 7, `AuditLog` + `/admin/audit`) — jo e përfunduar.

### Kufizime të Fazës 1
- MANAGER/STAFF **provisionohen** vetëm në Fazën 7 (`invitations/accept` i shtyrë); Faza 1 krijon vetëm OWNER; rolet e tjera testohen duke shtuar membership direkt.
- **Audit i admin-it mungon** (shih më sipër) — Faza 7.
- `requireRestaurantAccess` bën 1 query membership për kërkesë private (pa cache); optimizim nëse duhet, më vonë.
- `/m/[slug]` tani `force-dynamic`: korrektësi e menjëhershme e gate-it kundrejt cache-it; nëse ngarkesa publike rritet, rikonsidero cache afatshkurtër VETËM për përmbajtjen, jo për gate-in.
- Faqet `analytics`/`tasting-menus` janë placeholder (pa të dhëna); gate-i i rolit shtohet kur të marrin të dhëna.

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
