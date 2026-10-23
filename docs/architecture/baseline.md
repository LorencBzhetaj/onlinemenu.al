# Faza 0 — Baseline i kodit aktual

_Përditësuar: 2026-10-23 · Repo: `lorencbzhetaj/onlinemenu.al` · Branch: `main-wes312`_

Ky dokument është fotografia e **gjendjes reale të kodit** mbi të cilën ndërtohet
masterplani (`docs/OnlineMenu-Plan-Arkitekture-Prompte.md`). Është përditësuar sipas
kodit aktual, jo sipas commit-it `07a9b39` të auditimit fillestar.

## Git

| | |
|---|---|
| Repo kryesore | `lorencbzhetaj/onlinemenu.al` (e vetmja në scope të këtij sesioni) |
| Branch pune | `main-wes312` |
| Commit-e mbi `origin/main-wes312` (94b6b19) | `b1b32d6` (email verification), `478d9a4` (forcime), + forcimet A1/A2 të këtij raundi |
| Repo burim booking `restorant` | **Jo në scope të këtij sesioni** — nuk u lexua as u audituar këtu; integrimi është Faza 4 |

> Pamje: commit-et e verifikimit të email-it janë LOKALE (pa push), me bundle të rikuperueshëm të dërguar. Shih `IMPLEMENTATION-STATUS.md`.

## Teknologjia (versionet aktuale të fiksuara)

| Paketa | Versioni | Shënim |
|---|---|---|
| next | ^14.2.15 (14.2.35 build) | App Router |
| react / react-dom | ^18.3.1 | — |
| prisma / @prisma/client | ^5.22.0 | PostgreSQL (Neon prod); `url`=pooled, `directUrl`=direct |
| next-auth | ^4.24.11 | JWT strategy, pa adapter; Credentials + Google + `verify-login` |
| @dnd-kit/{core,sortable,utilities} | ^6/^10/^3 | drag-and-drop i menusë |
| tailwindcss | ^3.4.14 | + CSS tokens |
| bcryptjs | ^2.4.3 | hash password/kod |
| resend | ^6.22.1 | email (forgot + verifikim) |
| qrcode, react-colorful, browser-image-compression | — | QR, color picker, kompresim imazhi |
| typescript | ^5.6.3 | strict |
| Node | 22.x | ambienti aktual |

**Vendim versionesh:** stack-u është konsistent me objektivat e masterplanit (TS/Next/React/Prisma/Tailwind). **Nuk ka major-version drift brenda kësaj repoje.** Rreziku i përzierjes së major-versions del vetëm kur të integrohet repo `restorant` (Faza 4): auth, dnd, React dhe Prisma duhen krahasuar atëherë me prova (build+teste), jo të quhen të sigurta paraprakisht. ADR-të: `docs/architecture/decisions.md`.

## Inventari i rrugëve (nga `next build`)

**Publike / auth:** `/` · `/login` · `/register` · `/register/check-email` · `/verify-email` · `/forgot-password` · `/reset-password` · `/onboarding` · `/m/[slug]` (menu publike).

**Dashboard (pronar):** `/dashboard` · `/menu` · `/tasting-menus` · `/branding` · `/settings` · `/qr` · `/billing` · `/analytics`.

**Admin (super admin):** `/admin` · `/admin/restaurants` · `/admin/restaurants/[id]`.

**API:** `auth/[...nextauth]` · `register` · `resend-verification` · `forgot-password` · `reset-password` · `onboarding` · `categories[/id]` · `subcategories[/id]` · `menu-items[/id]` · `menu/reorder` · `restaurant/branding` · `restaurant/settings` · `admin/restaurants/[id]/subscription` · `cron/check-subscriptions`.

## Modeli i të dhënave aktual (`prisma/schema.prisma`)

`User` (role: SUPER_ADMIN | RESTAURANT_OWNER, emailVerified, pendingRestaurantName) · `Restaurant` (ownerId, slug, branding, kontakte, publikim, hero) · `Subscription` (1:1 me Restaurant, plan+status+expiresAt) · `Category` → `Subcategory?` → `MenuItem` · `TastingMenu` · `MenuView` (analitikë) · `PasswordResetToken` · `EmailVerification` (tokenHash/codeHash/version/attempts) · `RateLimit`.

## Autorizimi & multi-tenancy sot

- **Identiteti:** NextAuth JWT. `jwt` callback vendos `token.sub`, `token.role`, `token.emailVerified`, dhe **per-request** `token.restaurantId/Slug` nga `restaurant.findFirst({ ownerId: token.sub })`.
- **Dashboard API:** `getAuthedRestaurantId()` (→ `session.user.restaurantId`) + helper-at `categoryBelongsTo/subcategoryBelongsTo/itemBelongsTo` (`src/lib/api-auth.ts`) verifikojnë pronësinë e çdo objekti. `restaurantId` **kurrë nuk merret nga body-ja**.
- **Admin API:** kontroll `role === "SUPER_ADMIN"` te `admin/layout.tsx` dhe rruga e subscription-it.
- **Menu publike** `/m/[slug]`: lexon nga slug-u, respekton `isVisible/sortOrder` dhe statusin e abonimit.

### Harta reuse / adapt / new (për masterplanin)

| Fusha | Gjendja | Vendimi |
|---|---|---|
| User/Restaurant, menu CRUD, branding, upload, QR, abonim manual | **Ekziston, i përdorshëm** | **Reuse** |
| AL/EN + menu publike nga DB | Ekziston | Reuse |
| Email (forgot + **verifikim**), rate-limit PG, teste | Ekziston (i ri) | Reuse/zgjero |
| **Membership, rol i zgjeruar (MANAGER/STAFF), restoranti aktiv** | **Mungon** | **New — Faza 1** |
| **Entitlement MENU/BOOKING** | Mungon (Subscription single-plan) | **New — Faza 1** |
| **Booking (availability, tavolina, zona, rezervime)** | **Jo në këtë repo** | **Adapt nga `restorant` — Faza 4** |
| Design system i unifikuar (tokens/komponentë sipas mockup-eve) | Pjesërisht (Tailwind + ca tokens) | Adapt — Faza 2 |

## Boshllëqe tenant/rol për Fazën 1

1. **Pronësi 1:1 me `ownerId`**, pa `RestaurantMembership`: s'ka staf/menaxher, as shumë restorante për user.
2. **"Restoranti aktiv" = `findFirst({ ownerId })`** — zgjedhje implicite; pa përzgjedhje eksplicite kur një user ka >1 restorant.
3. **Rolet e trashë** (SUPER_ADMIN | RESTAURANT_OWNER); mungojnë OWNER/MANAGER/STAFF të nivelit restorant.
4. **Pa entitlement per-modul**: `Subscription` është një plan/status, jo MENU/BOOKING të ndara.
5. **Autorizimi bazohet te `ownerId`**, jo te membership + rol; `requireRestaurantAccess(action)` (nga masterplani) nuk ekziston ende.

Këto boshllëqe janë pikërisht lënda e **Fazës 1** (`docs/architecture/phase-1-spec-and-plan.md`).

## Komanda verifikimi (të riprodhueshme, ambient i izoluar)

```bash
# 1) Varësitë (lockfile i rregulluar; npm ci i pastër kalon)
npm ci

# 2) Typecheck
npx tsc --noEmit

# 3) Teste (kundrejt Postgres LOKAL testimi; guard refuzon DB jo-lokale) — shih tests/README.md
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/onlinemenu_test"
export DIRECT_URL="$DATABASE_URL"
npm run db:deploy:test   # guard (DATABASE_URL+DIRECT_URL lokale) + migrate deploy
npm test                 # `pretest` rikontrollon guard-in

# 4) Build (s'ekzekuton migrate deploy; s'prek DB live)
npm run build
```

### Rezultatet e baseline-it (ekzekutuar në këtë sesion)

| Kontrolli | Rezultati |
|---|---|
| `npm ci` nga instalim i pastër | ✅ kalon (pas rregullimit të lockfile-it) |
| `tsc --noEmit` | ✅ 0 gabime |
| `npm test` (verifikim email + rate-limit) | ✅ **76/76** |
| `npm run build` | ✅ kalon; **nuk** ekzekuton `migrate deploy` |
| Mockup-et e miratuar | `docs/design/*.png` (public, panel, admin, mobile) |

**Failures ekzistuese:** asnjë në këtë repo. (Suita e testeve mbulon verifikimin e email-it dhe rate-limit-in; mbulim më i gjerë unit/integration shtohet gjatë fazave.)
