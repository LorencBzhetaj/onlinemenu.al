# MenuDigjitale — Platformë SaaS për Menu Digjitale

Platformë multi-tenant për restorante: menu digjitale premium, QR i pandryshueshëm,
personalizim vizual, dygjuhëshe (AL/EN). Ndërtuar me Next.js 14 + Prisma + NextAuth.

## Statusi: Faza 1 — Themelet ✅ + CRUD i Menusë ✅

Themelet dhe moduli i menaxhimit të menusë janë ndërtuar dhe validuar (build kalon pastër,
faqja publike verifikohet me të dhëna reale).

**CRUD i menusë** (`/dashboard/menu`): menaxhim i plotë i kategorive, nën-kategorive dhe
artikujve me drag-and-drop (`@dnd-kit`), toggle i shpejtë i dukshmërisë, modale formulari,
dhe upload imazhesh (Cloudinary + fallback URL). Çdo rrugë API skopohet te restoranti i
pronarit të loguar (izolim multi-tenant).

**Personalizim / Branding** (`/dashboard/branding`): color picker (`react-colorful`) për
ngjyrat primare/theksi, 6 tema të gatshme, zgjedhje fontesh (Google Fonts), upload logoje
me fallback inicialesh, dhe **preview live** që simulon Hero-n publike para ruajtjes.
Fontet ngarkohen dinamikisht te `/m/[slug]` përmes `<link>` — ndryshimet reflektohen me
rifreskim, pa rebuild.

**Faqja publike e plotë** (`/m/[slug]`): rindërtuar sipas prototipit të miratuar —
Header sticky + toggle AL/EN (vetëm një gjuhë, localStorage), Hero me gradient dinamik
(primary→accent), toggle Menu Kryesore/Degustuese, category tabs me scroll-snap,
karta menuje, layout 2-kolonësh për nën-kategori, menu degustuese, dhe footer me buton
**Rezervo Tavolinë** që hap WhatsApp. Respekton `isVisible`, `sortOrder`, dhe statusin e
abonimit. Tema + fontet vijnë nga fushat e restorantit; teksti dygjuhësh nga DB.

**Upload imazhesh** (`image-upload.tsx`): 3 opsione — **Bëj Foto** (kamera), **Zgjidh nga
Pajisja**, ose **URL** — me kompresim automatik në klient (`browser-image-compression`,
max 1200px) para ngarkimit te Cloudinary. Përdoret te artikujt e menusë dhe logo.

**Cilësime** (`/dashboard/settings`): profili i restorantit në 4 seksione — Identiteti
(emri; slug read-only me paralajmërim QR), Përmbajtja e Hero-s (viti, tagline/nëntitull
AL/EN me mini-preview), Kontakti (telefon/WhatsApp me validim/adresë), dhe **toggle
"Menu Aktive/Jo Aktive"** (`isPublished`). Faqja publike shfaqet vetëm kur menuja është
aktive **DHE** abonimi është aktiv.

**QR Kod** (`/dashboard/qr`): gjenerim client-side (libraria `qrcode`) i QR-it që kodon
`/m/[slug]`, në të zezë/të bardhë për lexueshmëri. Shkarkim **PNG** (1000px, printim) dhe
**SVG** (vektor për madhësi të mëdha), plus buton "Kopjo Link". URL-ja mbetet e njëjtë
përgjithmonë — ndryshimi i emrit s'e prek QR-in e printuar (slug i pandryshueshëm).

### Të dhëna testi (opsionale)

```bash
node --env-file=.env --import tsx prisma/test-data.ts
```

Krijon "Gjeçaj Restaurant" (`/m/gjecaj-restaurant`, login `gjecaj@test.al` / `gjecaj1234`).

## Stack

| Shtresa | Teknologjia |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | **SQLite** (lokal) → PostgreSQL (para deploy-it) |
| ORM | Prisma |
| Auth | NextAuth.js (Credentials, JWT, role SUPER_ADMIN / RESTAURANT_OWNER) |
| QR | `qrcode` (do të integrohet te /dashboard/qr) |

## Fillimi i shpejtë

```bash
npm install
npx prisma db push      # krijon dev.db nga schema
npx prisma db seed      # krijon Super Admin fillestar
npm run dev             # http://localhost:3000
```

**Super Admin fillestar** (nga `.env`): `admin@platforma.al` / `admin1234`
→ ndrysho këto vlera para deploy-it.

## Skriptet

| Komandë | Përshkrim |
|---|---|
| `npm run dev` | Server zhvillimi |
| `npm run build` | Build produksioni (gjeneron Prisma + kompilon) |
| `npm run db:push` | Sinkronizon schema-n me DB |
| `npm run db:seed` | Krijon Super Admin |
| `npm run db:studio` | Prisma Studio (shfleton DB-në) |

## Struktura e rrugëve

```
/                          Landing (marketing)
/login, /register          Auth për pronarët
/dashboard                 Paneli i restorantit
  /menu /tasting-menus      (placeholder — Faza 1)
  /branding /qr /analytics
  /settings /billing
/admin                     Super Admin
  /restaurants             Listë + statuse abonimi
  /restaurants/[id]        Detaje restoranti
/m/[slug]                  ★ Faqja publike e menusë (skanohet nga QR)
```

## Kalimi te PostgreSQL (para deploy-it)

1. Krijo projekt falas te [Neon](https://neon.tech) ose [Supabase](https://supabase.com)
2. Te `prisma/schema.prisma`: `provider = "postgresql"`
3. Te `.env`: `DATABASE_URL` = connection string
4. `TastingMenu.courses`: ndrysho nga `String` në `Json`
5. `npx prisma db push`

## Hapat e ardhshëm (roadmap)

- **Faza 1 (MVP) — E PLOTË ✅:** ~~CRUD i menusë~~ · ~~branding~~ · ~~cilësime~~ · ~~faqja publike~~ · ~~gjenerim QR~~ · ~~menaxhim abonimi te admin~~
- **Faza 2:** vlerësim me yje, Rekomandime Shefi, Menu Ditore
- **Faza 3:** analitika, zinxhirë (multi-restorant), porosi nga dhoma
- **Faza 4:** Stripe, nëndomain custom, white-label
