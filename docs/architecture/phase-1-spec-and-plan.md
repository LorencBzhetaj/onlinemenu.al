# Faza 1 — Specifikim + Plan teknik: Tenant context, role dhe skema bazë

_Status: **PROPOZIM për review** — pa implementim. Repo: `onlinemenu.al` · branch pune: `main-wes312` (ose worktree i dedikuar)._

> Varësi: Faza 0 (`baseline.md`) e përfunduar. Kjo fazë NUK prek booking-un (Faza 4) dhe NUK nis implementim derisa të miratohet.

## 1. Qëllimi

Shndërro pronësinë aktuale 1:1 (`Restaurant.ownerId`) në një model **membership + rol + restorant aktiv**, me **izolim tenant** të zbatuar në server dhe **entitlement MENU/BOOKING** të ndara. Pa këtë, booking-u multi-restorant (Faza 4) dhe stafi/abonimet (Faza 7) s'mund të ndërtohen sigurt.

### Rezultati (Definition of Done)
- Përdoruesi A nuk lexon as ndryshon asnjë të dhënë të restorantit B — përfshirë API, nested parent IDs dhe membership të revokuar.
- "Restoranti aktiv" zgjidhet dhe verifikohet **në server**, jo nga `restaurantId` arbitrar.
- Rolet OWNER/MANAGER/STAFF zbatohen për veprime; revokimi vlen në veprimin e radhës të serverit (jo i varur nga JWT i vjetër).
- MENU/BOOKING janë entitlement të ndara; moduli joaktiv ndalon shkrimet përkatëse por jo leximin e historikut.

## 2. Jashtë fushëveprimit (për faza të tjera)
- Motori i booking-ut dhe UI (Faza 4–5). Këtu shtohet vetëm *entitlement*-i BOOKING, pa logjikë rezervimi.
- Design system i plotë (Faza 2). Këtu lejohet UI minimal për "ndrysho restorantin aktiv".
- Ftesa staff me email të plota (Faza 7) — këtu skema `StaffInvitation` + pranimi bazë; UI i plotë më vonë.

## 3. Ndryshimet e skemës (propozim)

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
  expiresAt      DateTime?
  @@unique([subscriptionId, module])
}

model StaffInvitation {
  id           String     @id @default(cuid())
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  restaurantId String
  email        String
  role         String     // "MANAGER" | "STAFF"
  tokenHash    String     @unique // njësoj si verifikimi: ruhet hash
  expiresAt    DateTime
  acceptedAt   DateTime?
  createdAt    DateTime   @default(now())
  @@index([restaurantId])
}

// User: shto restorantin aktiv (zgjedhje eksplicite, validohet me membership).
// User { ... activeRestaurantId String? ... memberships RestaurantMembership[] ... }
// Restaurant { ... memberships RestaurantMembership[] ... }
// Subscription { ... entitlements ModuleEntitlement[] ... }
```

**`Restaurant.ownerId` mbahet** (burim kanonik i pronarit; membership-i OWNER derivohet prej tij). Heqja e tij është pastrim i mëvonshëm me ADR të veçantë — jo tani, që rrjedhat ekzistuese të mos prishen.

### Migrimi + backfill (në ambient prove, jo Neon live)
Migrim i ri që krijon tabelat e mësipërme dhe `User.activeRestaurantId`, plus backfill:
```sql
-- Çdo restorant ekzistues → membership OWNER për pronarin e tij.
INSERT INTO "RestaurantMembership" (id, "userId", "restaurantId", role, status, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."ownerId", r.id, 'OWNER', 'active', now(), now()
FROM "Restaurant" r
ON CONFLICT ("userId","restaurantId") DO NOTHING;

-- Restoranti aktiv fillestar = i vetmi që zotëron (nëse s'është vendosur).
UPDATE "User" u SET "activeRestaurantId" = (
  SELECT r.id FROM "Restaurant" r WHERE r."ownerId" = u.id ORDER BY r."createdAt" LIMIT 1
) WHERE u."activeRestaurantId" IS NULL;

-- Entitlement: MENU=active për abonimet ekzistuese (produkti aktual është menu-only);
-- BOOKING=disabled derisa moduli i booking-ut të integrohet (Faza 4/5).
INSERT INTO "ModuleEntitlement" (id, "subscriptionId", module, status, "expiresAt")
SELECT gen_random_uuid()::text, s.id, 'MENU', 'active', s."expiresAt" FROM "Subscription" s
ON CONFLICT ("subscriptionId", module) DO NOTHING;
INSERT INTO "ModuleEntitlement" (id, "subscriptionId", module, status, "expiresAt")
SELECT gen_random_uuid()::text, s.id, 'BOOKING', 'disabled', NULL FROM "Subscription" s
ON CONFLICT ("subscriptionId", module) DO NOTHING;
```
> `gen_random_uuid()` kërkon `pgcrypto` (ose gjenero cuid në kod). Zgjidhet në planin e implementimit.

## 4. Shtresa e shërbimit (signatures)

```ts
// src/modules/memberships/access.ts
export type Role = "OWNER" | "MANAGER" | "STAFF";
export type AccessContext = { userId: string; restaurantId: string; role: Role };

// Zgjidh restorantin aktiv të user-it + membership-in aktiv; rikontroll NË SERVER
// (jo mbështetje te JWT i vjetër). Hedh nëse s'ka membership aktiv ose roli s'e lejon veprimin.
export function requireRestaurantAccess(action: string): Promise<AccessContext>;

// src/modules/memberships/permissions.ts
export const PERMISSIONS: Record<string, Role[]>; // action -> rolet e lejuar
export function roleCan(role: Role, action: string): boolean;

// src/modules/memberships/active-restaurant.ts
// Vendos User.activeRestaurantId VETËM nëse ka membership aktiv për të; përndryshe hedh.
export function selectActiveRestaurant(userId: string, restaurantId: string): Promise<void>;

// src/modules/subscriptions/entitlements.ts
export function hasEntitlement(restaurantId: string, module: "MENU" | "BOOKING"): Promise<boolean>;
```

Harta rol→veprim (fillestare; finalizohet në spec para kodit):

| Veprim | OWNER | MANAGER | STAFF |
|---|---|---|---|
| menu/branding/profil/links (shkrim) | ✓ | ✓ | ✗ |
| lexo të dhënat e tenant-it | ✓ | ✓ | ✓ |
| tavolina/orare/rregulla (Faza 4+) | ✓ | ✓ | ✗ |
| staf/abonim | ✓ | ✗ | ✗ |
| rezervime+status (Faza 5) | ✓ | ✓ | ✓ |

## 5. Integrimi me auth-in ekzistues

- `jwt` callback: zëvendëso `restaurant.findFirst({ ownerId })` me logjikë membership:
  `restaurantId = user.activeRestaurantId` (nëse ka membership aktiv) ose membership-i i parë aktiv; vendos edhe `token.activeRole`.
- Revokimi: `requireRestaurantAccess` rilexon membership-in **nga DB** në çdo mutacion (JWT-ja mbahet si hint, jo si e vërtetë autoritative për leje).
- `src/lib/api-auth.ts` zëvendësohet gradualisht: `getAuthedRestaurantId()` → `requireRestaurantAccess(action)`; helper-at `*BelongsTo` mbeten për verifikim objektesh brenda tenant-it.
- `middleware.ts`: shto redirect kur owner s'ka asnjë membership/restorant → `/onboarding`; super admin → `/admin` (si tani).

## 6. Rrugë të reja / të ndryshuara
- **New** `POST /api/dashboard/active-restaurant` → `selectActiveRestaurant` (membership i vlefshëm; jo restaurantId nga body pa kontroll).
- **Adapt** `categories|subcategories|menu-items|menu/reorder|restaurant/*` → `requireRestaurantAccess('menu:write'|'branding:write'|…)` + `hasEntitlement(restaurantId,'MENU')` për shkrime; lexim historik lejohet kur moduli skadon.
- **New (minimal)** `POST /api/invitations/accept` + skema `StaffInvitation` (UI i plotë në Fazën 7).

## 7. Teste të para (shkruaj testin që dështon → implemento)

`tests/integration/` (Postgres i izoluar, jo mock):
1. **Isolation lexim/shkrim:** A i loguar me restorantin e vet s'merr/ndryshon dot kategori/nënkategori/pjatë të B → 403/404, pa rrjedhje; `*BelongsTo` refuzon nested parent të B.
2. **Reorder me ID të huaja:** refuzohet i tëri, jo sukses i pjesshëm.
3. **Restoranti aktiv:** user me 2 membership-e → `selectActiveRestaurant` ndërron kontekstin; API scope-on te i zgjedhuri; s'mund të zgjedhë një ku s'është anëtar.
4. **Revokim:** MANAGER i revokuar → veprimi i radhës refuzohet (pa u mbështetur te JWT-ja).
5. **Rol:** STAFF s'edit menu/branding; MANAGER po; OWNER menaxhon staf/abonim.
6. **Entitlement:** MENU `disabled`/`expired` → shkrim menuje `MODULE_INACTIVE`; lexim historik OK; BOOKING `disabled` → s'ka efekt te menuja.
7. **Backfill:** çdo restorant ekzistues fiton membership OWNER + `activeRestaurantId`; `ModuleEntitlement` MENU=active, BOOKING=disabled.

## 8. Skedarët (prekje të pritura)
`prisma/schema.prisma` + migrim i ri · `src/modules/memberships/{access,permissions,active-restaurant}.ts` · `src/modules/subscriptions/entitlements.ts` · `src/lib/auth.ts` (jwt/session + `activeRole`) · `src/types/next-auth.d.ts` · `src/app/api/dashboard/active-restaurant/route.ts` · rrugët ekzistuese të dashboard-it (adaptim guard-esh) · `src/middleware.ts` · `tests/integration/*`.

## 9. Komanda & kritere përfundimi
```bash
npm ci && npx tsc --noEmit
# DB lokale testimi:
npx prisma migrate deploy && npm test   # përfshi tests/integration të rinj
npm run build
```
**Kritere:** të gjitha testet e reja të isolimit/rol/entitlement kalojnë; build pa migrim prod; diff+migrim i shqyrtuar; asnjë `restaurantId` nga body pa kontroll; backfill i provuar në ambient të izoluar. Dorëzim: diff, migrim, komanda+rezultate, përditësim i `IMPLEMENTATION-STATUS.md`.

## 10. Rreziqe
- **JWT i ndenjur vs. revokim:** zgjidhet duke rilexuar membership-in në server për çdo mutacion.
- **Tranzicion pa prishje:** `ownerId` mbahet; rrugët migrohen një nga një me teste, jo refaktorim i madh njëherësh.
- **Backfill:** idempotent (`ON CONFLICT DO NOTHING`), i provuar në kopje/izoluar para çdo aplikimi; asnjë aplikim live pa review.
- **Entitlement BOOKING:** `disabled` deri në Fazën 4/5 që UI të mos premtojë funksion që s'ekziston.
