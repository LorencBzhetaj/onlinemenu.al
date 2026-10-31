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
| Faza 3 — profil QR, lidhje, menu e plotë | ✅ **implementuar**; teste 41/41 + E2E 23/23; 0 overflow @390/1440; **lokal, pa push/migrim live** |
| Faza 4 — motori i rezervimeve (booking) | ✅ **motori + shërbimet** (multi-tenant); teste 43/43 (+ ruajtja e historikut); **lokal, pa push/migrim live** |
| Faza 5 — UX booking + njoftime | ✅ **implementuar** (formular publik, menaxhim nga klienti, panel, njoftime); teste 23/23 + E2E 15/15; 0 overflow; **lokal, pa push/migrim live** |
| Faza 6 — marketplace & kërkimi | ✅ **implementuar** (kryefaqe zbulimi, `/restaurants` me filtra në URL, disponueshmëri reale, SEO/sitemap/JSON-LD); teste 30/30 + E2E 23/23; 0 overflow; **lokal, pa push/migrim live** |
| Faza 7 — staf, abonime, admin & analitika | ✅ **implementuar** (ftesa/role/revokim, aktivizim modulesh + rinovim, AuditLog, analitika reale, qytet/kuzhinë te cilësimet); teste 43/43 + E2E 14/14; 0 overflow; **lokal, pa push/migrim live** |

---

## 0.6 Faza 7 — Stafi, abonimet, administrimi dhe analitika (e implementuar)

**Skema (lokal):** `Invitation` (ftesë me skadim + token SHA-256 njëpërdorimësh), `AuditLog` (aktor/veprim/restorant/kohë, pa sekrete/token), `AnalyticsEvent` (tenant-scoped, pa PII). Migrim `20261102000000_phase7_team_audit_analytics` — **vetëm aditiv**, aplikuar **vetëm lokal**; schema↔migrations pa diferencë.

**1. Ekipi** (`src/modules/memberships/invitations.ts` + `/dashboard/team` + `/invite/[token]`):
- `createInvitation` (VETËM OWNER; role **MANAGER/STAFF**, kurrë OWNER → invarianti); token RAW kthehet një herë, ruhet vetëm SHA-256; skadim 7 ditë; anëtar aktiv → `already_member`.
- `acceptInvitation` **atomik + njëpërdorimësh** (guard `updateMany` count===1; garë → një fiton); email i user-it duhet të përputhet; krijon/riaktivizon membership; pas pranimit rifreskohet JWT-ja (`update()`) që middleware të njohë membership-in e ri.
- `revokeMembership` — **invarianti i OWNER** (OWNER s'revokohet; mbetet ≥1 OWNER aktiv); izolim tenant. `revokeInvitation` për ftesat pending. Anëtari i revokuar humb aksesin menjëherë (`resolveAccess` → no_membership).
- Lejet: `team:read`/`team:write` **vetëm OWNER** (STAFF/MANAGER refuzohen).

**2. Abonimet & modulet:** aktivizim i **ndarë** MENU/BOOKING **per-restorant** (kurrë global) — `setModuleStatus` + `/api/admin/restaurants/[id]/modules` (SUPER_ADMIN) + toggles te admin detail. **Rinovim pa humbur periudhën e mbetur**: `computeRenewalExpiresAt` = `max(sot, skadimi) + ditët e planit` (aktiv → zgjat nga skadimi; i skaduar → nga sot). Pa integrim pagesash (shënim manual).

**3. AuditLog** (`src/modules/admin/audit.ts` + `/admin/audit`): regjistron `subscription.update/renew`, `module.activate/disable`, `team.invite/accept/revoke` me aktor (email+rol), restorant, veprim dhe kohë. **Pa sekrete/token** (verifikuar me test). Best-effort (s'rrëzon veprimin kryesor).

**4. Analitika reale** (`src/modules/analytics/events.ts`): evente **profile_view, menu_view, item_view, wolt_click** (beacon publik `/api/public/events`, vetëm profile të publikuara, izolim tenant, pa PII) dhe **booking_created** (server-side, në tx-në e rezervimit). `getAnalyticsSummary` jep totale + pjatat më të klikuara (emra realë); faqja `/dashboard/analytics` zëvendëson placeholder-in me metrika reale + empty states. **Klikimet Wolt nuk etiketohen porosi/rezervime.**

**5. Cilësimet:** fushat **qytet/kuzhinë** te `/dashboard/settings` (+ API) që pronari plotëson të dhënat e kërkimit (Faza 6). Nav: shtuar **Ekipi**.

**Kontroll verifikimi:** `tests/phase7.test.ts` **43/43** (ftesa skadim/ripërdorim/konkurrencë, invarianti OWNER, revokim, leje, aktivizim modulesh, rinovim, trial i skaduar, audit pa token, agregime analitike + izolim tenant). `tests/e2e/phase7.e2e.ts` **14/14** (owner fton → staf pranon → leje të kufizuara; analitika reale; audit; aktivizim moduli nga admin; screenshots @390/1440 → **0 overflow**). `tsc` 0 · `next build` OK · suita e plotë njësi **305/305**.

---

## 0.5 Faza 6 — Marketplace dhe kërkimi (e implementuar)

Zbulimi i restoranteve me **të dhëna reale**, mbi gate-in ekzistues dhe motorin e Fazës 4. **Pa logjikë paralele disponueshmërie; pa slot të sajuar.**

**Skema (lokal):** `Restaurant.city`, `Restaurant.cuisine` (opsionale, pa vlera të sajuara; editohen te Settings — UI e plotë në Fazën 7). Indekse `@@index([isPublished, city])` / `([isPublished, cuisine])`. Migrim `prisma/migrations/20261101000000_phase6_discovery_city_cuisine` — **vetëm aditiv**, aplikuar **vetëm lokal**; schema↔migrations pa diferencë.

**Shërbim kërkimi** — `src/modules/restaurants/search.ts`:
- `parseSearchParams` validon **në server**: `q`, `city`, `cuisine`, `date` (datë kalendarike reale), `time` (HH:MM), `guests` (1..`MAX_GUESTS`), `page` (≥1). Vlerat e pavlefshme bihen në heshtje.
- `searchRestaurants` liston **vetëm** `isPublished && !suspendedAt` (njëjtë si dukshmëria e profilit); filtra qytet/kuzhinë (case-insensitive equals) + emër (contains); pagination `PAGE_SIZE=12` me **clamp** të faqes. Kthen vetëm fusha publike (pa `id`/`ownerId`/email).
- **Disponueshmëria** vetëm nga `getAvailableTimes` (motori i Fazës 4), vetëm për faqen aktuale të rezultateve dhe vetëm për restorantet me **BOOKING aktiv**; e kufizuar në `SLOTS_PER_CARD=5` (slot-et më pranë orës së kërkuar). Pa query të pakufizuara për restorant.
- `getSearchFacets` → qytete/kuzhina reale dalluese (vetëm nga publike jo-të pezulluara) për dropdown-et.

**API** — `GET /api/public/restaurants` (publik; vetëm profile të publikuara).

**Faqet:**
- `/` (kryefaqja) — kërkim konsumatori (→ `/restaurants`) + **restorante reale** të publikuara; CTA dytësore "Je restorant?" ruan rrjedhën e pronarit.
- `/restaurants` — shirit filtrash që **pasqyron filtrat në URL** (Back i ruan), rrjetë rezultatesh, pagination; **gjendjet loading** (`loading.tsx` skeleton), **pa rezultate** (`EmptyState`) dhe **gabim** (`error.tsx`). Karta → profil; slot → `/restaurants/[slug]/reserve` me **date/guests/time të bartura**.
- `/restaurants/[slug]/reserve` — lexon `searchParams` dhe parambush `ReserveFlow` (auto-load i orëve + parazgjedhje e orës); **rikontrolli autoritativ mbetet në krijim** (motori i Fazës 4).

**SEO:** `metadataBase` (NEXT_PUBLIC_BASE_URL); profil me **canonical** + OpenGraph + **JSON-LD `schema.org/Restaurant`** me të dhëna reale (**pa `aggregateRating`/çmim të sajuar**); profilet e fshehura `noindex`. `sitemap.xml` → **vetëm** faqe publike + profile të publikuara (profil/menu/info), pa panel/reserve/bookings. `robots.txt` → disallow `/api`, `/dashboard`, `/admin`, `/onboarding`, `/bookings`, token-flows. `/bookings/[token]` **noindex** (token/PII).

**Kontroll verifikimi:** `tests/phase6.test.ts` **30/30** (validim, gate publikim/pezullim, filtra qytet/kuzhinë/emër, facets, pagination+clamp, rend stabil, disponueshmëri reale + timezone, kufi `SLOTS_PER_CARD`, pa slot kur s'ka BOOKING, pa të dhëna private). `tests/e2e/phase6.e2e.ts` **23/23** (kryefaqe me të dhëna reale, listim + filtra në URL, slot → reserve me parametra të bartur, pa rezultate, sitemap/robots/JSON-LD/noindex; screenshots @390/1440 → **0 overflow**). `tsc` 0 · `next build` OK · suita e plotë njësi **262/262**.

---

## 0.4 Faza 5 — UX booking + njoftime (e implementuar)

Mbi motorin e Fazës 4: formulari publik, menaxhimi nga klienti, paneli i plotë dhe njoftimet. **BOOKING nuk aktivizohet globalisht** — vetëm restorantet testuese.

**Korrigjim i historikut (para Fazës 5):** FK-të `Reservation/ReservationTable → tavolinë/klient` u kthyen në **RESTRICT** (tavolina/klient me rezervime NUK fshihen aksidentalisht). Shërbime: `setTableActive` (çaktivizim), `deleteTable`/`deleteCustomer` (refuzojnë me histori), `purgeRestaurantBookingData` (rrjedhë e posaçme fshirjeje tenant-i, në rend). Pastrimi i fixtures tani në rend (jo dobësim FK-je). Regression test në `phase4.test.ts` (7 kontrolle).

**1. Rezervimi publik** — `/restaurants/[slug]/reserve`: hapa datë → persona/zonë/orë → kontakt → konfirmim. Disponueshmëria + krijimi përdorin motorin e Fazës 4; slot-i i zënë ndërkohë → mesazh + rifreskim. API: `GET /api/public/restaurants/[slug]/availability`, `POST .../reservations` (BOOKING aktiv + rate limit + idempotency).

**2. Menaxhimi nga klienti** — `/bookings/[token]`: detajet, **anulim me POST** (`/api/public/bookings/[token]/cancel`), **shto në kalendar** (`/calendar.ics`), udhëzime. Ndryshimi nga klienti = kërkesë kontakti; **riplanifikimin e bën stafi** (v1).

**3. Paneli** — `/dashboard/reservations` (lista e ditës, walk-in/telefon, statuset, riplanifikim), `/dashboard/customers` (kërkim, fshirje me politikë), `/dashboard/tables` (zona, tavolina, kombinime, plan salle me pozicion x/y/w/h), `/dashboard/hours` (orar, mbyllje, kufij slot-i, politika). **OWNER/MANAGER** ndryshojnë konfigurimin (`booking:config`); **STAFF** menaxhon vetëm rezervimet (`reservations:*`). Guard: `guardBooking` = rol + entitlement BOOKING (leximet s'kërkojnë modul aktiv, shkrimet po).

**4. Njoftimet** — `NotificationJob` krijohet **në të njëjtin transaksion** me rezervimin; worker-i (`runNotificationWorker`) i dërgon **pas commit-it** me **lease + retry (backoff) + dedupe** (`dedupeKey` unik); dështim → Failed→backoff→Dead; **dështimi i email-it NUK anulon booking-un**. Evente: konfirmim, anulim, riplanifikim, kujtesë 24h, raport ditor (`generateDailyDigest`, idempotent me `DailyReport`). Dërguesi i **injektueshëm** → test sink, **pa dërgime reale**. Cron: `/api/cron/notifications` (CRON_SECRET). Rrugët publike bëjnë kick worker-it pas commit-it (best-effort).

**5. Butoni Rezervo** i profilit/informacionit lidhet me **formularin e brendshëm** kur BOOKING është aktiv (jo kontakt wa.me).

**Module/skedarë:** `src/modules/booking/{notifications,guards}.ts` + zgjerime te `reservations.ts`/`config.ts`; `src/components/public/{reserve-flow,cancel-booking}.tsx`; faqe publike `/reserve`, `/bookings/[token]`(+`.ics`); panel `/dashboard/{reservations,customers,tables,hours}`; API `/api/public/*`, `/api/dashboard/{reservations,customers,booking/*}`, `/api/cron/notifications`. Leje të reja: `booking:config`, `customers:write`.

**Migrimi (lokal):** `prisma/migrations/20261031000000_phase5_booking_ux_notifications` — FK → RESTRICT + `NotificationJob`/`NotificationDelivery`/`DailyReport`. **Aplikuar vetëm lokal.** Schema↔migrations: pa diferencë.

**Kontroll verifikimi:** `tests/phase5.test.ts` **23/23** (job në tx, worker/sink, dedupe, retry→Dead, lease/konkurrencë, email failure s'anulon booking, cancel/reschedule jobs, digest idempotent). `tests/e2e/phase5.e2e.ts` **15/15** (klient rezervon → stafi sheh/riplanifikon → klienti anulon; njoftime pas commit-it; cron 401/200; screenshots @390/1440 → **0 overflow**). `tsc` 0 · `next build` OK · suita e plotë njësi **232/232**.

---

## 0.3 Faza 4 — Motori i rezervimeve (e implementuar: motori + shërbimet)

Motori ekzistues i repo-s burim `github.com/LorencBzhetaj/restorant` (single-tenant, Villa Gjeçaj) u **ripërdor dhe u përshtat** në multi-tenant — **jo i rindërtuar nga zero**. Repo-ja burim u klonua VETËM për lexim te `/home/user/lorencbzhetaj/restorant` (jashtë repo-s onlinemenu.al). **Booking-u live i Gjeçaj nuk u prek** (pa ndryshime instalimi/DB/konfigurimi/rezervimesh live).

**Përshtatja kryesore:** `restaurantId` në çdo entitet dhe operacion; lock-et këshillues per-slot të prefiksuar me restaurantId → izolim i plotë mes restoranteve.

**Modele të reja (tenant-scoped):** `BookingSettings` (një/restorant: turnDuration, bookingInterval, seatingBuffer, maxPartySize, slot caps, timezone), `Area`, `AreaClosure`, `RestaurantTable`, `TableCombination`(+`Member`), `ReservationTable`, `Customer` (unik `restaurantId+phone`), `Reservation` (unik `restaurantId+idempotencyKey`, cancelToken global), `OpeningHour`, `Closure`, `SlotLimit`. Branding/kontaktet rrinë te `Restaurant` (BookingSettings mban vetëm politika).

**Module** (`src/modules/booking/`):
- `timezone.ts` — konvertim IANA i qartë, DST-korrekt (i portuar); zona per-restorant (default Europe/Tirane).
- `availability.ts` — orë të lira, status per-tavolinë, gate orari, kombinime, slot caps; çdo query filtrohet me restaurantId.
- `reservations.ts` — `createReservation` (publik), `createWalkIn` (staf), `cancelReservationByToken`, `rescheduleReservation`, `setReservationStatus`. **Atomik** (`$transaction` + `pg_advisory_xact_lock` per-slot + per-tavolinë në rend deterministik), **idempotent** (çelës per-tenant; garë → kthen fituesin), **i sigurt ndaj konkurrencës** (assignment brenda lock-ut; `findOrCreateCustomer` race-safe). **Pa njoftime** (Faza 5).
- `config.ts` — shërbime CRUD tenant-scoped me validim pronësie (zona/tavolina/kombinime/orare/mbyllje/slot-limits).
- `guards.ts` — `guardBooking`/`requireBookingAccess` = rol (Faza 1 `reservations:*`) + entitlement **BOOKING**; leximet s'kërkojnë modul aktiv, shkrimet po.

**Aktivizim:** BOOKING mbetet `disabled` në provisionim (jo aktivizim global); `createRestaurantForOwner` tani krijon edhe `BookingSettings` default. Testet e aktivizojnë BOOKING **vetëm për restorantet testuese**.

**Migrimi (lokal):** `prisma/migrations/20261030000000_phase4_booking_engine` — shtesë e pastër (tabela booking + FK cascade për fshirje të pastër restoranti). **Aplikuar vetëm lokal me `npm run db:deploy:test`.** (Edhe: rikthim i `@@index([resetAt])` te RateLimit — drift i mëparshëm skema↔DB; schema↔migrations tani pa diferencë.)

**Kontroll verifikimi:** `tests/phase4.test.ts` **36/36** (Postgres i izoluar): izolim tenant (dy restorante; tavolinë/klient të ndarë), assignment single+kombinim, gate orari + mbyllje restoranti/zone, slot caps, kohëzgjatje+buffer, create/cancel/reschedule atomik, idempotencë (seri + paralele), konkurrencë (tavolinë e vetme → saktësisht një fiton), gate entitlement BOOKING. `tsc` 0 · `next build` OK.

**Mbetet për Fazën 5 (jo e nisur):** formulari publik `/reserve`, paneli i plotë (rezervime/tavolina/zona/orare/klientë/plan salle), njoftime (confirmation/cancel/reschedule/reminders/digest), unifikim i BookingSettings me profilin, slot search në marketplace.

---

## 0.2 Faza 3 — Profili QR, lidhjet dhe menuja e plotë (e implementuar)

Klienti hap **profilin** e restorantit nga QR; menuja, informacioni dhe lidhjet hapen prej tij. Brandi i restorantit ka përparësi; trupi përdor formatin e miratuar (sfond krem, karta të buta, cepa të rrumbullakosur, navigim i njëtrajtshëm në telefon).

**Rrugë publike të reja:**
- `/restaurants/[slug]` — profili (hero i brenduar + veprime Menu/Informacion + lidhje + telefon; rezervim vetëm kur ka modul + destinacion funksional).
- `/restaurants/[slug]/menu` — menuja e brenduar (kërkim pjatash, alergjenë, disponueshmëri, orare menuje).
- `/restaurants/[slug]/info` — informacion & kontakt (adresë/hartë, telefon, WhatsApp, lidhje).
- `/q/[code]` — **QR resolver** (kod opak → redirect te profili).
- `/m/[slug]` — **alias historik**: QR-të e printuara ruhen funksionale, tani ridrejtojnë te profili (slug i pandryshueshëm).

**QR hap profilin, jo menunë.** Kodi QR është **opak e i pandryshueshëm** (`QrCode.code`); ndryshimi i emrit/menusë nuk e prek. QR-i tani kodon `/q/[code]`; `/m/[slug]` i vjetër redirekton te profili.

**Lidhjet e jashtme (Wolt/Maps/Instagram/Website):** opsionale, hapen nga shfletuesi; serveri **nuk** bën fetch. Validim: **vetëm HTTPS** + **host allowlist** për Wolt (`wolt.com`), Instagram (`instagram.com`), Maps (Google). Telefoni → `tel:` (i normalizuar). **Wolt = vetëm lidhje e jashtme.**

**Rezervimi (gated):** shfaqet **vetëm** kur entitlement **BOOKING** është aktiv **DHE** ka destinacion funksional (WhatsApp/telefon i restorantit) — kontakt, jo motor rezervimesh. **NUK** lidhet me booking-un live të Gjeçaj. Meqë BOOKING është `disabled` për të gjithë (Faza 1), butoni nuk shfaqet në praktikë; motori i plotë `/reserve` → Faza 5.

**Menu e plotë:** alergjenë (tenant-scoped, M:N me artikujt) · **hidden (`isVisible=false`) kundrejt temporarily unavailable (`isAvailable=false`)** · orare menuje (dritare javore Europe/Tirane; kategoria shfaqet publikisht vetëm brenda dritares) · kërkim pjatash (emër/përshkrim) · menu degustuese CRUD · çmimet mbajnë njësinë ALL.

**Paneli:** `/dashboard/links` (lidhjet, validim + aktivizo/fshi), `/dashboard/tasting-menus` (CRUD kurse/çmim/persona), menaxherë **Alergjenët** + **Oraret** te faqja Menu, alergjenë + disponueshmëri te forma e artikullit, orar te forma e kategorisë, përshkrim profili (about AL/EN) te Cilësime, QR tani kodon `/q/[code]`.

**Module të reja:** `src/modules/restaurants/{public-profile,external-links,qr}.ts`, `src/modules/menu/schedule.ts`, `src/lib/public-theme.ts`, `src/components/public/*`.

**Migrimi (lokal):** `prisma/migrations/20261025000000_phase3_...` — `RestaurantExternalLink`, `QrCode`, `Allergen`, `MenuItemAllergen`, `MenuSchedule` + `Category.scheduleId` + `MenuItem.isAvailable` + `Restaurant.{mapsUrl,aboutAl,aboutEn}` + backfill QR-kod për restorantet ekzistuese. **Aplikuar vetëm lokal me `npm run db:deploy:test`.**

**Akses:** API-të e reja përdorin `guardRestaurant(header)` + entitlement **MENU** për shkrimet e menusë (alergjenë/orare/tasting/menu-items); lidhjet/profili = `links/settings:write` (pa MENU). Alergjenët e lidhur me artikuj filtrohen me tenant (s'lidhen cross-tenant).

**Kontroll verifikimi:** `tests/phase3.test.ts` **41/41** (validim URL, QR resolver + ndryshim emri, orare, profil/gate, reserveDestination, menu data, izolim tenant). `tests/e2e/phase3.e2e.ts` **23/23** (QR→profil, `/m`→profil, profil/menu/info, Wolt jashtme, rezervim i gated-uar, kërkim, alergjen, disponueshmëri, akses API; screenshots @390/1440 → **0 overflow**). `tsc` 0 · `next build` OK.

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
