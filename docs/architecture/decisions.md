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

## Të hapura (vendosen në fazën përkatëse me prova)
- Versionet përfundimtare kur integrohet `restorant` (auth/dnd/React/Prisma) — Faza 4.
- Hosting (Vercel/VPS) pas kontrollit të worker runtime/kufijve — Faza 8.
- Provider-i i email-it (Resend vs. SMTP ekzistues) — Faza 5.
- Mekanizmi i "restorantit aktiv" (cookie vs. fushë në DB) — finalizohet në Fazën 1 (shih spec-in).
