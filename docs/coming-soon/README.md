# Production — faqja "Së shpejti" (dega `coming-soon-production`)

Ndryshim i vogël mbi `main` (`94b6b19`), i ndarë nga platforma (`redesign-approved-palette` s'është bashkuar).

## Çfarë bën
- `/` → faqe statike (pa DB), 200. Logo-teksti "OnlineMenu.al", H1 "Së shpejti", "Coming soon", tagline
  "Menu digjitale dhe rezervime tavolinash." (14 px telefon / 16 px desktop) dhe përshkrimi i produktit.
- Sfondi: `public/coming-soon/mobile.webp` (portret) ose `desktop.webp` (peizazh) me `<picture>` — shkarkohet vetëm njëri.
  Pa spinner, pa animacion, pa vonesë; teksti është HTML.
- Çdo rrugë tjetër (`/login`, `/register`, `/dashboard`, `/admin`, `/onboarding`, `/m/*`, `/api/*`, çdo URL e panjohur)
  → 404 me `X-Robots-Tag: noindex, nofollow` (src/middleware.ts). Lejohen vetëm `/`, `robots.txt`, `sitemap.xml`,
  ikonat, `opengraph-image.jpg`, `/coming-soon/*`, `/brand/*`.
- SEO: title "OnlineMenu.al – Menu digjitale dhe rezervime | Së shpejti", description, canonical
  `https://www.onlinemenu.al` (onlinemenu.al → 308 → www), Open Graph + Twitter me `opengraph-image.jpg` (1200×630),
  favicon/apple-icon nga logoja zyrtare, `lang="sq"`, JSON-LD vetëm Organization/WebSite (emri, URL, logo).
- Indeksimi: Production → `index, follow`, robots `Allow: /` + sitemap me një URL. Preview → `noindex` + robots `Disallow: /`
  (mbrojtja e Vercel mbetet).
- `package.json` `build` = `next build` (hiqet `prisma migrate deploy`: ky publikim s'bën migrime).
  `/m/[slug]` dhe `/admin/restaurants` u bënë `force-dynamic` që build-i të mos prekë DB-në.
- Fontet vetë-hostohen nga `next/font` (pa Google Fonts nga shfletuesi). Root layout s'ka më `SessionProvider`
  (s'ka hyrje në këtë fazë).

## GTM / matja — E FIKUR në këtë publikim
- Kodi: `src/components/analytics/consent-gtm.tsx`, kontejneri `GTM-WGNJNLHT` (`src/lib/site-config.ts`).
- Ndizet vetëm me `NEXT_PUBLIC_ANALYTICS_ENABLED=1` (s'është vendosur në Vercel). Edhe kur ndizet, GTM ngarkohet vetëm
  pas "Prano"; "Refuzo" ose pa zgjedhje → asnjë kërkesë te Google. Ndryshimi Prano→Refuzo fshin `_ga*` dhe ringarkon.
  Snippet-i zyrtar i GTM; `dataLayer` inicializohet me `consent default` para `gtm.js`; pa gtag.js paralel; pa `<noscript>` iframe
  (do ta anashkalonte pëlqimin).
- Testuar lokalisht (kërkesat te googletagmanager.com u bllokuan në test): pa zgjedhje 0 kërkesa; Prano → 1 skript;
  ringarkim → 1; Refuzo → 0 + cookie `_ga` i fshirë; ringarkim → 0.
- **Nuk u verifikua** (pa akses): konfigurimi brenda kontejnerit (a ka Google tag GA4, ID-ja e matjes, trigger-at),
  Tag Assistant / GA4 DebugView (page_view një herë). Rrezik: nëse GA4 tag-u në GTM dërgon page_view dhe ka edhe
  "History Change", mund të dyfishohet — kontrollohet në DebugView.
- Çfarë matet (kur ndizet): vetëm ajo që konfigurohet në GTM; faqja s'shtyn asnjë event me të dhëna personale
  (pa email, telefon, rezervime, token-e apo URL private — faqja s'ka asnjë të tillë).
- Para ndezjes: politika e privatësisë/cookies për Production (s'ekziston në këtë degë) + vendimi ligjor.

## Publikimi (kërkon miratim)
1. `git push origin coming-soon-production`
2. Fast-forward `main` → `coming-soon-production` dhe `git push origin main` (Vercel Production = dega `main`).
3. Pas deploy-it: `curl -I https://www.onlinemenu.al/` (200), `/robots.txt`, `/sitemap.xml`, `/login` (404 noindex),
   canonical/OG në HTML.

## Search Console (s'ka akses nga ky sesion)
1. search.google.com/search-console → shto property "Domain" `onlinemenu.al` (verifikim DNS TXT te regjistruesi i domenit)
   ose "URL prefix" `https://www.onlinemenu.al/`.
2. Sitemaps → dërgo `https://www.onlinemenu.al/sitemap.xml`.
3. URL Inspection → `https://www.onlinemenu.al/` → "Test live URL" → "Request indexing".
