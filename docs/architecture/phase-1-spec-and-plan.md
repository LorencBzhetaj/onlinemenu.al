# Faza 1 — Specifikim + Plan teknik: Tenant context, role dhe skema bazë

_Status: **PROPOZIM i miratuar në parim** — përfshin vendimet e review-t. Pa implementim. Repo: `onlinemenu.al` · branch pune: `main-wes312` (ose worktree i dedikuar)._

> Varësi: Faza 0 (`baseline.md`). NUK prek booking-un (Faza 4) dhe NUK nis implementim derisa spec-i të miratohet përfundimisht.

## 1. Qëllimi

Shndërro pronësinë 1:1 (`Restaurant.ownerId`) në **membership + rol + restorant aktiv**, me **izolim tenant** të zbatuar në server për çdo **lexim privat dhe mutacion**, dhe **entitlement MENU/BOOKING** të ndara.

### Definition of Done
- Përdoruesi A nuk **lexon** as **ndryshon** asnjë të dhënë private të B — API, nested IDs, membership i revokuar.
- Restoranti i çdo kërkese **lidhet me faqen/formularin e hapur** dhe verifikohet me membership; **pa fallback të heshtur** te një restorant tjetër.
- Rolet OWNER/MANAGER/STAFF zbatohen për çdo veprim; revokimi vlen në veprimin e radhës të serverit.
- MENU/BOOKING entitlement të ndara me tabelë vendimesh të qartë.

## 2. Vendimet e review-t (detyruese)

1. **`requireRestaurantAccess` për ÇDO lexim privat DHE mutacion** — jo vetëm shkrimet. JWT dhe middleware janë vetëm *hint*; autoriteti final i lejeve është serveri (rilexon membership nga DB).
2. **Restoranti aktiv i lidhur me kërkesën (anti cross-tab):** restaurantId-ja e një kërkese vjen **shprehimisht nga faqja/formulari i hapur** (segment URL ose fushë e qartë e kërkesës), jo nga një *pointer* i ndryshueshëm "aktiv". Ndryshimi i restorantit aktiv në një tab tjetër **nuk** e ridrejton një shkrim te tenant tjetër. **Asnjë fallback i heshtur** te `activeRestaurantId` për shkrime (as për lexime private).
3. **Invariant `ownerId` ↔ OWNER membership:** çdo Restaurant ka saktësisht një membership OWNER me `userId == Restaurant.ownerId`. Në këtë fazë **ndalohet** transferim/fshirje/revokim që e lë restorantin pa pronarin kanonik.
4. **`hasEntitlement` me tabelë vendimesh** (subscription status, module status, expiresAt, null expiry, restaurant suspension). **Backfill nuk riaktivizon abonime joaktive.**
5. **Të gjitha rrjedhat e krijimit të restorantit** (email verification, Google/onboarding, admin, seed) krijojnë **atomikisht**: Restaurant + OWNER membership + Subscription + ModuleEntitlements.
6. **Action permissions konkrete** në vend të "lexim i përgjithshëm i tenant-it": veprim i panjohur → **refuzohet (deny-by-default)**. STAFF nuk lexon billing/team/settings private automatikisht. Super-admin kontrollohet në server dhe përdor **rrugë të audituara**, jo rrugët e pronarit.
7. **`invitations/accept` shtyhet në Fazën 7** (bashkë me `StaffInvitation`) — pranim atomik, email i verifikuar, skadim, revokim dhe mbrojtje replay specifikohen atje, jo tani.
8. **Guard i DB-së së testit** kontrollon `DATABASE_URL` **dhe** `DIRECT_URL` PARA `migrate deploy` (migrate deploy përdor DIRECT_URL). Komandat e testimit përdorin `npm run db:deploy:test` dhe `pretest`; `migrate deploy` i pa-guard-uar s'jepet për testim. _(Zbatuar tashmë si tooling — shih `scripts/require-local-db.mjs`.)_

## 3. Jashtë fushëveprimit
- Motori/UI i booking-ut (Faza 4–5) — këtu shtohet vetëm *entitlement* BOOKING (status `disabled`).
- Design system i plotë (Faza 2).
- **Ftesa staff (`StaffInvitation` + `invitations/accept`) → Faza 7** (vendim #7). Në Fazën 1 ekzistojnë vetëm membership-et OWNER (nga backfill + krijimi); MANAGER/STAFF-i testohen duke krijuar membership direkt në DB, por provisionimi real vjen në Fazën 7.

## 4. Ndryshimet e skemës (propozim)

```prisma
model RestaurantMembership {
  id           String     @id @default(cuid())
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  restaurantId String
  role         String     // "OWNER" | "MANAGER" | "STAFF"
  status       String     @default("active") // "active" | "revoked"
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  @@unique([userId, restaurantId])
  @@index([restaurantId])
  @@index([userId])
}

model ModuleEntitlement {
  id             String       @id @default(cuid())
  subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  subscriptionId String
  module         String       // "MENU" | "BOOKING"
  status         String       @default("active") // "active" | "expired" | "disabled"
  expiresAt      DateTime?    // null = pa skadim në nivel moduli (qeveris subscription-i)
  @@unique([subscriptionId, module])
}

// User:       + activeRestaurantId String?   (vetëm DEFAULT navigimi; JO autoritet lejesh)
//             + memberships RestaurantMembership[]
// Restaurant: + suspendedAt DateTime?        (pezullim administrativ; UI e plotë → Faza 7)
//             + memberships RestaurantMembership[]
// Subscription: + entitlements ModuleEntitlement[]
```

**`StaffInvitation` NUK përfshihet në Fazën 1** (vendim #7).
**`Restaurant.ownerId` mbahet** si burim kanonik (shih invariantin, §6).

### Migrimi + backfill (ambient prove, JO Neon live)
```sql
-- 1) Membership OWNER për çdo restorant ekzistues.
INSERT INTO "RestaurantMembership" (id,"userId","restaurantId",role,status,"createdAt","updatedAt")
SELECT md5(random()::text||r.id), r."ownerId", r.id, 'OWNER', 'active', now(), now()
FROM "Restaurant" r
ON CONFLICT ("userId","restaurantId") DO NOTHING;

-- 2) Restoranti aktiv fillestar = i pari që zotëron (vetëm default navigimi).
UPDATE "User" u SET "activeRestaurantId" = (
  SELECT r.id FROM "Restaurant" r WHERE r."ownerId" = u.id ORDER BY r."createdAt" LIMIT 1
) WHERE u."activeRestaurantId" IS NULL;

-- 3) Entitlement MENU: PASQYRON gjendjen e abonimit (NUK riaktivizon abonime joaktive).
INSERT INTO "ModuleEntitlement" (id,"subscriptionId",module,status,"expiresAt")
SELECT md5(random()::text||s.id), s.id, 'MENU',
       CASE WHEN s.status IN ('trial','active') THEN 'active' ELSE 'expired' END,
       s."expiresAt"
FROM "Subscription" s
ON CONFLICT ("subscriptionId",module) DO NOTHING;

-- 4) Entitlement BOOKING: 'disabled' derisa moduli i booking-ut të integrohet (Faza 4/5).
INSERT INTO "ModuleEntitlement" (id,"subscriptionId",module,status,"expiresAt")
SELECT md5(random()::text||s.id||'b'), s.id, 'BOOKING', 'disabled', NULL
FROM "Subscription" s
ON CONFLICT ("subscriptionId",module) DO NOTHING;
```
> ID-të gjenerohen me `md5(random())` për të shmangur varësinë nga `pgcrypto`; në kod përdoret `cuid()`. Backfill idempotent (`ON CONFLICT DO NOTHING`). **Aplikohet vetëm në ambient të izoluar me `npm run db:deploy:test`**, pas query-t të pamjes paraprake.

## 5. `hasEntitlement` — tabela e vendimeve

`hasEntitlement(restaurantId, module)` lexon Restaurant (suspendedAt), Subscription (status, expiresAt) dhe ModuleEntitlement (status, expiresAt). Rendi i vlerësimit:

| # | Kushti | Rezultati |
|---|---|---|
| 1 | `Restaurant.suspendedAt` ≠ null | **false** (të gjitha modulet) |
| 2 | Subscription mungon OSE `status` ∈ {expired, cancelled} | **false** |
| 3 | ModuleEntitlement mungon për modulin | **false** |
| 4 | `ModuleEntitlement.status` ≠ 'active' (p.sh. disabled/expired) | **false** |
| 5 | `ModuleEntitlement.expiresAt` ≠ null DHE `< now()` | **false** |
| 6 | `Subscription.expiresAt` ≠ null DHE `< now()` | **false** |
| 7 | ndryshe (përfshi `expiresAt = null` me status active/trial) | **true** |

Shënime: `expiresAt = null` në nivel moduli → pa skadim moduli; qeveris subscription-i (rreshti 6). Statusi lexohet **në server** në çdo kërkesë; cron-i vetëm raporton, nuk është burimi i vetëm i së vërtetës. Moduli joaktiv **ndalon shkrimet** përkatëse (`MODULE_INACTIVE`) por **lejon leximin e historikut** dhe nuk çaktivizon anulimin e rezervimeve ekzistuese (Faza 5).

## 6. Shtresa e shërbimit (signatures)

```ts
// src/modules/memberships/access.ts
export type Role = "OWNER" | "MANAGER" | "STAFF";
export type AccessContext = { userId: string; restaurantId: string; role: Role };

// restaurantId vjen SHPREHIMISHT nga konteksti i kërkesës (segment URL / fushë e validuar),
// JO nga activeRestaurantId. Rikontroll NË SERVER: membership aktiv + roli lejon `action`.
// Hedh (refuzon) nëse s'ka membership aktiv për këtë restaurantId, ose roli s'e lejon,
// ose `action` është i panjohur. ASNjë fallback te activeRestaurantId.
export function requireRestaurantAccess(action: string, restaurantId: string): Promise<AccessContext>;

// src/modules/memberships/permissions.ts
export const PERMISSIONS: Record<string, Role[]>; // listë shterуese; mungesa = deny-by-default
export function roleCan(role: Role, action: string): boolean; // false për action të panjohur

// src/modules/memberships/active-restaurant.ts
// Vendos User.activeRestaurantId VETËM nëse ka membership aktiv; përndryshe hedh.
// Është DEFAULT navigimi për shell-in, jo autoritet lejesh.
export function selectActiveRestaurant(userId: string, restaurantId: string): Promise<void>;
export function listMemberships(userId: string): Promise<{ restaurantId: string; role: Role; name: string }[]>;

// src/modules/subscriptions/entitlements.ts
export function hasEntitlement(restaurantId: string, module: "MENU" | "BOOKING"): Promise<boolean>;

// src/modules/restaurants/provision.ts  (zëvendëson/zgjeron ensureRestaurantWithTrial)
// ATOMIK (brenda tx): Restaurant + Subscription(trial) + OWNER membership + MENU(active)+BOOKING(disabled).
export function createRestaurantForOwner(db: Tx, ownerId: string, name: string): Promise<{ slug: string; created: boolean }>;
```

### Harta rol → veprim (deny-by-default; shterуese)

| action | OWNER | MANAGER | STAFF |
|---|:--:|:--:|:--:|
| `menu:read` | ✓ | ✓ | ✓ |
| `menu:write`, `branding:write`, `links:write`, `settings:write` | ✓ | ✓ | ✗ |
| `branding:read`, `links:read`, `settings:read`, `analytics:read`, `qr:read` | ✓ | ✓ | ✗ |
| `billing:read`, `team:read`, `team:write`, `subscription:read` | ✓ | ✗ | ✗ |
| `reservations:read/write`, `customers:read` (Faza 5) | ✓ | ✓ | ✓ |
| action i panjohur | ✗ | ✗ | ✗ |

> STAFF në Fazën 1 ka vetëm `menu:read` (dhe rezervime/klientë në Fazën 5). **Nuk** lexon billing/team/settings private. Super-admin NUK zgjidhet nga `requireRestaurantAccess`; përdor `src/app/api/admin/*` me kontroll roli + audit.

## 7. Invarianti `ownerId` ↔ OWNER membership

- Çdo Restaurant ka **saktësisht një** membership OWNER, me `userId == Restaurant.ownerId`.
- Krijimi i restorantit (çdo rrugë, §8) e krijon këtë membership atomikisht.
- Në Fazën 1 shërbimi **refuzon**: revokim/fshirje të membership-it OWNER; heqje të pronarit; transferim pronësie (rrjedhë e posaçme e mëvonshme). Një restorant **kurrë** s'mbetet pa pronar kanonik.
- `team:write` nuk mund të prekë rreshtin OWNER (vetëm MANAGER/STAFF menaxhohen në Fazën 7).

## 8. Rrjedhat e krijimit të restorantit (të gjitha atomike)

Të gjitha përdorin `createRestaurantForOwner(tx, ownerId, name)` brenda një transaksioni:

| Rrjedha | Skedari | Shënim |
|---|---|---|
| Email verification | `consumeVerification` (`src/lib/email-verification.ts`) | tashmë në `$transaction`; shtohet membership+entitlements |
| Google / onboarding | `src/app/api/onboarding/route.ts` | zëvendëson `ensureRestaurantWithTrial` |
| Admin krijim | `src/app/api/admin/restaurants/*` | brenda tx + audit |
| Seed | `prisma/seed.ts` | i njëjti helper |

Rezultati: Restaurant, OWNER membership, Subscription(trial) dhe ModuleEntitlements krijohen **të gjitha ose asnjë** (rollback).

## 9. Integrimi me auth + rrugët

- `jwt`/`session`: `token.activeRestaurantId` + `token.activeRole` si *hint* për UI/navigim. **Autorizimi real** bëhet nga `requireRestaurantAccess(action, restaurantId)` në server për çdo lexim/shkrim privat.
- `src/lib/api-auth.ts`: `getAuthedRestaurantId()` → zëvendësohet gradualisht nga `requireRestaurantAccess`; `*BelongsTo` mbeten për verifikim objektesh brenda tenant-it.
- **New** `POST /api/dashboard/active-restaurant` → `selectActiveRestaurant` (default navigimi; jo autoritet).
- **Adapt** rrugët e dashboard-it: marrin restaurantId **shprehimisht** (segment URL ose fushë e validuar) + `requireRestaurantAccess(action, id)` + `hasEntitlement(id,'MENU')` për shkrime. Lexim historik lejohet kur moduli skadon.
- `middleware.ts`: hint-e navigimi (owner pa membership → `/onboarding`; super-admin → `/admin`); **jo** autoriteti final.

## 10. Teste të para (test-first; shkruaj testin që dështon → implemento)

`tests/integration/` (Postgres i izoluar). Çdo pikë e review-t ka test:

1. **Lexim+shkrim privat (vendim #1):** A s'lexon menu/branding/settings të B (jo vetëm s'shkruan) → refuzohet, pa rrjedhje. `*BelongsTo` refuzon nested parent të B.
2. **Revoked private reads (#1):** membership me `status='revoked'` → `menu:read` dhe `billing:read` refuzohen në kërkesën e radhës (JWT-ja s'besohet).
3. **Cross-tab writes (#2):** kërkesë me `restaurantId=R1` (nga faqja e R1) shkruan te R1 edhe kur `activeRestaurantId=R2`; kërkesë me `restaurantId=R3` (pa membership) → refuzohet; **asnjë** shkrim s'bie te activeRestaurantId.
4. **Reorder me ID të huaja:** refuzohet i tëri.
5. **ownerId↔OWNER (#3):** revokim/fshirje e OWNER-it ose heqje pronari → refuzohet; restoranti s'mbetet pa pronar.
6. **Entitlement table (#4):** rast për çdo rresht të tabelës (suspended; subscription cancelled/expired; module disabled/expired; expiresAt i kaluar; expiresAt null+active; happy). MENU disabled → shkrim `MODULE_INACTIVE`, lexim historik OK.
7. **Cancelled-subscription backfill (#4):** restorant me `subscription.status='cancelled'` → backfill krijon MENU me status jo-'active'; `hasEntitlement(MENU)` → **false** (pa riaktivizim).
8. **Krijim user/restorant pas verifikimit (#5):** `consumeVerification` krijon ATOMIKISHT Restaurant+Subscription+OWNER membership+MENU(active)+BOOKING(disabled); në dështim → asnjë prej tyre (rollback).
9. **Action permissions (#6):** action i panjohur → refuzohet; STAFF `billing:read`/`team:read`/`settings:read` → refuzohet; super-admin s'zgjidhet nga `requireRestaurantAccess`.
10. **Restoranti aktiv (#2):** user me 2 membership-e; `selectActiveRestaurant` ndërron default-in; s'mund të zgjedhë një ku s'është anëtar.

## 11. Skedarët (prekje të pritura)
`prisma/schema.prisma` + migrim i ri · `src/modules/memberships/{access,permissions,active-restaurant}.ts` · `src/modules/subscriptions/entitlements.ts` · `src/modules/restaurants/provision.ts` · `src/lib/auth.ts` + `src/types/next-auth.d.ts` · `src/app/api/dashboard/active-restaurant/route.ts` · rrugët ekzistuese të dashboard-it (adaptim) · `src/middleware.ts` · `prisma/seed.ts` · `tests/integration/*`.

## 12. Komanda & kritere përfundimi
```bash
npm ci && npx tsc --noEmit
export DATABASE_URL="postgresql://postgres@127.0.0.1:5433/onlinemenu_test"; export DIRECT_URL="$DATABASE_URL"
npm run db:deploy:test   # guard (DATABASE_URL+DIRECT_URL lokale) + migrate deploy
npm test                 # përfshi tests/integration të rinj
npm run build
```
**Kritere:** të gjitha testet e §10 kalojnë; build pa migrim prod; diff+migrim i shqyrtuar; asnjë `restaurantId` nga body pa kontroll; backfill i provuar në ambient të izoluar; `hasEntitlement` sipas tabelës. Dorëzim: diff, migrim, komanda+rezultate, përditësim i `IMPLEMENTATION-STATUS.md`.

## 13. Rreziqe
- **JWT i ndenjur vs. revokim:** `requireRestaurantAccess` rilexon membership nga DB në çdo lexim/shkrim privat.
- **Cross-tab:** restaurantId gjithmonë nga konteksti i kërkesës; pa fallback te activeRestaurantId.
- **Tranzicion pa prishje:** `ownerId` mbahet; rrugët migrohen një nga një me teste.
- **Backfill:** idempotent, pasqyron gjendjen (s'riaktivizon abonime), i provuar në izolim para çdo aplikimi.
- **Entitlement BOOKING `disabled`** deri në Fazën 4/5.
