# Ridizajnimi OnlineMenu.al — shënime

Dega: `redesign-approved-palette` (nga `main-wes312` @ 5ab09f5). Pa push, pa deploy.

## Çfarë ndryshoi
- **Paleta e vetme** (`src/lib/om-theme.ts`, `tailwind.config.ts` → `om.*`, `globals.css` → `--om-*`):
  Butter `#FFE16A` (Rezervo + zgjedhjet aktive), Aubergine `#4C1845` (tekst/brand), Candy Pink `#FF79BD` (thekse),
  Warm White `#FFF8EE` (sipërfaqe). Teksti mbi Butter/Pink është gjithmonë Aubergine; teksti dytësor `#6E4D68` (~6.8:1).
  Fontet: Fredoka (tituj) + Nunito (tekst).
- **Faqet publike nuk përdorin më ngjyrat/fontet e restorantit** (`publicThemeVars` kthen paletën e miratuar).
  Të dhënat e brandit mbeten në DB dhe në panel; logoja + emri mbeten identiteti i restorantit.
- **Zbulo** (`/`, `/restaurants`): kërkim me qytet, karta kuzhinash (vetëm kuzhina reale) me Shefin e Bukës, karta restorantesh
  me Menuja/Rezervo. Pa vlerësime ose foto të sajuara.
- **Profili**: cover, logo/inicialet, kuzhina · qyteti, butonat Menuja / Rezervo / Wolt ↗ (cyan, vetëm me lidhje Wolt të vlefshme —
  rivalidohet në kohën e shfaqjes), kontakti, Vendndodhja; në desktop kolonë anësore për rezervimin.
- **Menuja**: kategori, kërkim, çmime në **ALL**. **Rezervimi**: e njëjta rrjedhë/klasa/tekste (smoke-test kalon), Butter për
  veprimin dhe orën e zgjedhur. Paneli i menaxhimit të rezervimit në paletën e re.
- **Loading** (`/restaurants/[slug]/loading.tsx`): 05 — Shefi i Bukës në kutinë rozë + logo + tri pika; shfaqet vetëm sa serveri
  përgatit faqen (QR → profil direkt, pa vonesë). Pikat ndalen me `prefers-reduced-motion`.

## Vendndodhja / harta — varësitë
- **Leaflet 1.9.4** (`leaflet`, `@types/leaflet`) — falas, pa çelës. Ngarkohet dinamikisht vetëm kur seksioni afrohet në ekran.
- **Tile: OpenStreetMap** (`tile.openstreetmap.org`) me atribuim. Politika e OSM s'lejon trafik të lartë prodhimi; para lansimit
  me shumë vizitorë, zgjidhni një ofrues tile-sh (p.sh. me plan falas/me pagesë) — **vendim i juaji**, asgjë me pagesë s'u aktivizua.
- **Routing**: opsional, `ROUTING_URL` (OSRM-compatible, p.sh. `https://<host>/route/v1/driving`). Bosh (default) →
  s'ka "Përdor vendndodhjen time"; mbetet "Merr udhëzime" (Google Maps, pa origjinë në URL).
  Me routing: leja kërkohet vetëm pas klikimit; pini "Ti" + itinerari vetëm nga përgjigja reale; pozicioni s'ruhet dhe s'kalon
  nga serveri ynë (shfletuesi e dërgon direkt te shërbimi routing i zgjedhur).
  Serveri demo publik i OSRM s'është për prodhim.
- **Koordinatat**: kolona të reja `Restaurant.latitude/longitude` (migrim aditiv `20261108000000_restaurant_coordinates`),
  të editueshme te Cilësime → Kontakti (validim në server). Fallback: koordinatat që ndodhen vetë në URL-në e Google Maps
  të pronarit. S'ka gjeokodim automatik. Pa koordinata: adresa + lidhja ekzistuese/udhëzimet, pa hartë.
  **Migrimi duhet aplikuar** (`npm run db:deploy`) në çdo DB para deploy-it të kësaj dege.

## Shefi i Bukës — asset-et
Mockup-et janë referencë; s'u prenë. `src/components/public/chef-mascot.tsx` shfaq një siluetë vektoriale vendmbajtëse.
Kur ilustrimet e veçuara (WebP/AVIF, sfond transparent) të jenë gati, vendosini te `public/brand/chef/` dhe regjistrojini te
`CHEF_ASSETS` (variantet: box, pizza, burger, fresh, sweets). Maskota përdoret vetëm në karta të vogla dhe loading — kurrë
mbi foto, çmime apo përshkrime pjatash; pa tekst "delivery".

## Verifikimi (lokal, DB Docker e përkohshme)
- `tsc --noEmit` ✅ · `next lint` ✅ (1 paralajmërim i vjetër te paneli i rezervimeve) · `next build` ✅
- QR `/q/<code>` → profil direkt ✅ · Menu + Wolt ✅ · Wolt i pavlefshëm fshihet ✅
- Rezervim → konfirmim → menaxhim → anulim (smoke-test lokal) ✅
- Harta: ngarkim dembel ✅, pa leje (refuzim) ✅, me leje + itinerar ✅ (routing me **mock lokal** vetëm për test),
  pa koordinata → adresa + udhëzime ✅. Asgjë s'ruhet në localStorage përveç gjuhës.
- Screenshots: `docs/redesign/screenshots/` (telefon 390×844, desktop 1366×900).
- Pa screenshot: ekrani i loading-u (shfaqet vetëm gjatë render-it të serverit).

## Jashtë kësaj detyre
App native (splash, navigim Zbulo/Kërko/QR/Rezervime/Profili) — referencë për fazën e ardhshme. Foto cover reale kërkon fushë
`coverUrl` + ngarkim te paneli (sot cover-i është brez me ngjyrë).
