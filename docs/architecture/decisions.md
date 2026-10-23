# Vendime arkitekturore (ADR)

_Repo: `lorencbzhetaj/onlinemenu.al` · përditësuar 2026-10-23_

Shënime të shkurtra vendimesh me arsye dhe pasoja. Një vendim ndryshohet me një ADR të ri, jo në heshtje.

---

## ADR-001 — Repo kryesore: `onlinemenu.al`
**Vendim:** ndërtojmë mbi `onlinemenu.al`; `restorant` lexohet si burim booking-u dhe mbahet i pandryshuar.
**Arsye:** `onlinemenu.al` ka tashmë identitet/restorant/menu/branding/QR/abonim dhe menu publike nga DB. Booking-u transferohet si modul (Faza 4).
**Pasojë:** asnjë merge mekanik historish/skemash/lockfiles. Nëse auditimi i përputhshmërisë gjen kosto më të ulët ndryshe, kërkohet ADR i ri me prova.

## ADR-002 — Identiteti: NextAuth v4 JWT, pa adapter
**Vendim:** mbahet NextAuth v4 me strategji JWT; linking sipas email-it në callbacks.
**Arsye:** ekziston e punon (Credentials + Google). Pa DB-adapter → më pak varësi.
**Pasojë:** lejet/rolet vendosen në token; revokimi i menjëhershëm (Faza 1) kërkon rikontroll në server, jo mbështetje te një JWT i vjetër.

## ADR-003 — Verifikim i detyrueshëm i email-it (link + kod)
**Vendim:** regjistrimi kërkon verifikim; link (tokenHash SHA-256) + kod (bcrypt) te një rekord i vetëm me `version`; Restaurant+trial krijohen vetëm pas verifikimit, atomikisht.
**Arsye:** parandalon llogari të pavlefshme/abuzive; onboarding i pastër.
**Pasojë:** GET s'konsumon (POST verifikon); login i paverifikuar bllokohet në server; konsumimi lidhet me `version` (ri-dërgimi invalidon të vjetrin); re-registration "latest-wins" atomik.

## ADR-004 — Rate limit i qëndrueshëm mbi PostgreSQL
**Vendim:** tabela `RateLimit` (upsert atomik), pa Redis/Upstash.
**Arsye:** limiter-i in-memory është i padobishëm në serverless; shmangim një shërbim shtesë.
**Pasojë:** verify është **fail-closed** (refuzon pa konsumuar kur limiter-i s'arrihet); register/resend/forgot janë **fail-open** (disponueshmëri). Prune periodik te cron-i ditor.

## ADR-005 — Backfill i verifikimit: i kufizuar, jo sipas datës
**Vendim:** grandfather vetëm përdoruesit që **zotërojnë Restaurant** ose janë **SUPER_ADMIN**; jo cutoff sipas `createdAt`.
**Arsye:** data e krijimit nuk provon besueshmëri; rrjedha e vjetër i krijonte menjëherë restorantin, pra pronarët legacy zotërojnë një.
**Pasojë:** regjistrimet e reja mbeten të paverifikuara; aplikohet qëllimisht, me query pamjeje para `migrate deploy`.

## ADR-006 — Ndaj build-in nga migrimet
**Vendim:** `build = next build`; migrimet me `npm run db:deploy` (hap i veçantë).
**Arsye:** build/preview nuk duhet të aplikojë `migrate deploy` mbi DB live automatikisht.
**Pasojë:** izolimi i plotë kërkon edhe DATABASE_URL/DIRECT_URL të ndara për Preview (heqja nga build-i s'mjafton) — shih `IMPLEMENTATION-STATUS.md`.

## ADR-007 — Çmimet në ALL si integer
**Vendim:** `MenuItem.price` mbahet integer në lek (ALL); pa shumëzim/konvertim të heshtur.
**Arsye:** shmang gabime rrumbullakimi; përputhet me masterplanin.
**Pasojë:** multi-currency do kërkojë migrim eksplicit, jo riemërtim të paqartë.

## ADR-008 — Autoriteti i lejeve: `requireRestaurantAccess` në server (Faza 1)
**Vendim:** çdo lexim privat DHE mutacion kalon nga `requireRestaurantAccess(action, restaurantId)`; JWT/middleware janë vetëm hint.
**Arsye:** JWT mund të jetë i ndenjur; revokimi duhet të vlejë menjëherë.
**Pasojë:** membership rilexohet nga DB në çdo kërkesë private; action i panjohur refuzohet (deny-by-default).

## ADR-009 — Restoranti aktiv i lidhur me kërkesën (anti cross-tab) (Faza 1)
**Vendim:** restaurantId vjen shprehimisht nga faqja/formulari i hapur dhe verifikohet me membership; `User.activeRestaurantId` është vetëm default navigimi.
**Arsye:** ndryshimi i "aktiv" në një tab s'duhet të ridrejtojë shkrime te tenant tjetër.
**Pasojë:** asnjë fallback i heshtur te activeRestaurantId për lexime/shkrime private.

## ADR-010 — Invariant `ownerId` ↔ OWNER membership (Faza 1)
**Vendim:** çdo Restaurant ka një OWNER membership = `ownerId`; në Fazën 1 ndalohet transferim/fshirje/revokim që e lë restorantin pa pronar.
**Pasojë:** krijimi atomik e krijon OWNER-in; `team:write` s'prek rreshtin OWNER.

## ADR-011 — `hasEntitlement` me tabelë vendimesh; backfill s'riaktivizon (Faza 1)
**Vendim:** vendimi merr parasysh suspension, subscription status/expiry, module status/expiry, null-expiry (shih spec-in §5). Backfill-i pasqyron gjendjen e abonimit, s'riaktivizon abonime joaktive.
**Pasojë:** moduli joaktiv ndalon shkrimet, lejon lexim historik; statusi lexohet në server.

## ADR-012 — Krijim atomik i restorantit në të gjitha rrjedhat (Faza 1)
**Vendim:** `createRestaurantForOwner` krijon Restaurant+Subscription+OWNER membership+entitlements brenda një tx; përdoret nga email-verification, onboarding, admin dhe seed.
**Pasojë:** asnjë gjendje e pjesshme; `invitations/accept` shtyhet në Fazën 7.

## ADR-013 — Guard i DB-së së testit para `migrate deploy`
**Vendim:** `scripts/require-local-db.mjs` kontrollon DATABASE_URL DHE DIRECT_URL të jenë lokale; testimi përdor `npm run db:deploy:test` + `pretest`. `db:deploy` (pa `:test`) mbetet vetëm për deploy-in e qëllimshëm prod.
**Arsye:** `migrate deploy` përdor DIRECT_URL; një DATABASE_URL lokal nuk mjafton për të shmangur migrim prod.

## Të hapura (vendosen në fazën përkatëse me prova)
- Versionet përfundimtare kur integrohet `restorant` (auth/dnd/React/Prisma) — Faza 4.
- Hosting (Vercel/VPS) pas kontrollit të worker runtime/kufijve — Faza 8.
- Provider-i i email-it (Resend vs. SMTP ekzistues) — Faza 5.
- Mekanizmi i "restorantit aktiv" (cookie vs. fushë në DB) — finalizohet në Fazën 1 (shih spec-in).
