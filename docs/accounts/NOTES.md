# Llogaritë (email / Google / Apple) dhe Njoftimet e rezervimeve — Faza 10

Statusi: **vetëm lokalisht** (dega `accounts-notifications-local`). Pa push, pa deploy, pa migrim live.

## Llogaritë
- Identiteti OAuth = `(provider, providerAccountId)` te `OAuthAccount`. Email-i s'mjafton kurrë për hyrje.
- **Pa lidhje automatike sipas email-it.** Email që përputhet me llogari ekzistuese → `/login?error=account_exists`
  (s'krijohet përdorues i dytë; llogaria ekzistuese — edhe e paverifikuar — mbetet e paprekur).
- Lidhja bëhet vetëm nga **Llogaria ime** (`/account`), pas rikonfirmimit (fjalëkalim ose hyrje ≤10 min),
  me cookie të nënshkruar `om_link_intent` (HMAC, 10 min).
- Urë kalimi: llogaritë e vjetra të krijuara nga Google (pa fjalëkalim, të verifikuara, pa identitet të lidhur)
  lidhen një herë me Google. Kurrë për Apple.
- Përdoruesi i ri OAuth = rol `USER`, pa restorant/trial/membership. Biznesi krijohet veçmas te `/onboarding`
  (kërkon email të verifikuar); roli bëhet `RESTAURANT_OWNER` brenda të njëjtit transaksion.
- Apple shfaqet vetëm kur `APPLE_CLIENT_ID` dhe `APPLE_CLIENT_SECRET` ekzistojnë.

## Njoftimet e rezervimeve (Paneli → Njoftime)
- Kanalet Email / WhatsApp (ndezje veç e veç), marrës me verifikim me kod 6-shifror (15 min, 5 tentativa);
  WhatsApp kërkon pëlqimin e marrësit. Maks. 10 marrës.
- Ngjarjet: rezervim i ri, ndryshim ore, anulim → një job për kanal/marrës (dedupe), me status dhe retry.
- Mesazhi: referenca `OM-XXXXXX`, ora, personat, lidhja e panelit. **Pa token anulimi.**
- Pa marrës email të verifikuar → email-i i verifikuar i pronarit.
- Akses: OWNER/MANAGER (`booking:config`); STAFF s'e sheh.
- WhatsApp është **gjithmonë i simuluar** (s'ka ofrues). Email live vetëm me `EMAIL_SEND_LIVE=1`.

## Para çdo migrimi në një DB të përbashkët
1. `npx tsx scripts/audit-email-conflicts.ts` (vetëm lexim; exit 3 = ka email-e të dyfishta pa dallim shkronjash).
2. Zgjidh konfliktet manualisht, pastaj `npm run db:deploy`
   (migrimi `20261109000000_oauth_accounts_notification_recipients` krijon `User_email_lower_key`).
3. **Preview ndan DB-në me Production** → mos e ekzekuto atje pa miratim.

## Bllokues të hapur
- Apple: Services ID, Team ID, Key ID, çelësi .p8, domain + callback `/api/auth/callback/apple`.
- WhatsApp: ofruesi s'është zgjedhur (vetëm simulim).
- Google OAuth: u testua realisht në Preview më 2026-11-10 (shih "Provat reale me Google" më poshtë).
- Teksti i privatësisë duhet përditësuar (identitetet OAuth, marrësit e njoftimeve) para aktivizimit të GTM.

## Testet
`npm test` (verification + fazat 1–10) ✅ në DB lokale Docker; `next build` ✅.
Screenshots: `docs/redesign/screenshots/mobile-50-hyrja-konflikt.png`, `mobile-51-llogaria-pa-biznes.png`,
`desktop-50-njoftime-rezervimesh.png`.

## Preview i izoluar (dega `accounts-notifications-local`) — gjendja më 2026-11-08
Konfiguruar në Vercel vetëm për këtë degë (Preview), vlerat s'janë printuar:
- Domen i qëndrueshëm: `https://onlinemenu-al-preview.vercel.app` (i lidhur me degën; mbrohet nga Vercel Authentication).
- `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL` → domeni i mësipërm. `NOINDEX=1`.
- `NEXTAUTH_SECRET`, `CRON_SECRET` → të reja, të ndara nga Production (sesionet e Preview s'vlejnë në Production).
- `DATABASE_URL`/`DIRECT_URL` (2026-11-10): DB-ja e testimit që përdornin Preview-t e mëparshme (vetëm të dhëna `@staging.demo`;
  asnjë shërbim live s'varet prej saj; "Së shpejti" s'e prek). Kur të dalim live → projekt i ri Neon.

## Worker-i i njoftimeve
Rrugët API e presin worker-in (`flushNotificationsAfterCommit`, kufi 4 s) para përgjigjes: në Vercel një premtim pa `await`
ngrinte dhe job-et mbeteshin Pending. `vercel.json` s'ka cron për `/api/cron/notifications`; job-et që dështojnë rikapen
te veprimi i radhës i atij restoranti.
- Të përbashkëta me Production: `GOOGLE_CLIENT_*`, `RESEND_API_KEY`, `EMAIL_FROM`, Cloudinary.
  Email-et e llogarisë (verifikim/rivendosje) dërgohen realisht kur ka `RESEND_API_KEY`; njoftimet e rezervimeve vetëm me `EMAIL_SEND_LIVE=1` (i fikur).

## Provat reale me Google (Preview, 2026-11-10)
Redirect URI i regjistruar: `https://onlinemenu-al-preview.vercel.app/api/auth/callback/google` (client-i i projektit 911459198924).

| Prova | Rezultati |
|---|---|
| Hyrje me Google, email i ri | ✅ `/account`; rol `USER`, email i verifikuar, pa fjalëkalim, 1 identitet, 0 anëtarësi; s'u krijua restorant/trial |
| Lidhje nga "Llogaria ime" e një identiteti që i përket llogarisë tjetër | ✅ refuzim `link_conflict`; sesioni s'ndryshoi |
| Email i njëjtë me llogari me fjalëkalim | ✅ refuzim `account_exists`; 1 përdorues, fjalëkalimi i paprekur, 0 identitete të reja |
| Ura për llogaritë e vjetra vetëm me Google | ✅ lidhje një herë te i njëjti përdorues; pa llogari të dytë |

Gjendja përfundimtare e llogarisë së testimit: vetëm Google, pa fjalëkalim, 1 identitet, rol `USER`, pa biznes.
S'u testua live: identitet i dytë Google me të njëjtin email (mbulohet nga Faza 10); Apple (i fshehur).
Llogari sintetike QA në DB-në e testimit: `qa-manager@staging.demo` (MANAGER te Te Gurra), `qa-pa-biznes@staging.demo`.

## Riprovimi automatik i njoftimeve (2026-11-11)
- Test (Faza 10, §13): dërguesi dështon → job `Failed` me backoff; pa asnjë veprim nga restoranti, endpoint-i
  `/api/cron/notifications` (me `CRON_SECRET`) e merr dhe e kalon në `Simulated`; historiku `failed,simulated`.
- Nisësi automatik: `.github/workflows/notifications-cron.yml` (çdo 5 min). Vercel Hobby lejon cron vetëm ditor dhe vetëm në
  Production. **Joaktiv derisa skedari të jetë në `main`** (GitHub ekzekuton `schedule` vetëm nga dega default) dhe të shtohen
  secrets `NOTIFY_CRON_URL`, `NOTIFY_CRON_SECRET` (+ `VERCEL_AUTOMATION_BYPASS` për Preview të mbrojtur).
