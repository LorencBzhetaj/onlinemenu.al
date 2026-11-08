# Politikat ligjore — të dhënat që mungojnë dhe gjetjet

Faqet `/kushtet`, `/privatesia`, `/cookies` janë **DRAFT** (noindex, njoftim DRAFT në krye). Përshkruajnë vetëm atë që
konfirmon kodi i degës `redesign-approved-palette`. Mos i publikoni në Production para shqyrtimit ligjor.

## Të dhëna që duhen plotësuar (shënuar në faqe si `[TË PLOTËSOHET: …]`)
| # | E dhëna | Ku |
|---|---|---|
| 1 | Operatori ligjor: emri, NIPT, adresa | Kushtet §1, Privatësia §1 |
| 2 | Email/kanali i kontaktit (përgjithshëm + privatësia) | Privatësia §1, §6; Cookies §5; Kushtet §1 |
| 3 | Baza ligjore për çdo qëllim përpunimi | Privatësia §3 |
| 4 | Roli për rezervimet (restoranti kontrollues / platforma përpunues?) + marrëveshja me restorantet | Privatësia §3 |
| 5 | Ofruesit e hostimit/DB të konfirmuar me kontratë (konfigurimi aktual: Vercel, Neon), vendndodhja e serverëve, transferimet jashtë vendit | Privatësia §4 |
| 6 | Afatet e ruajtjes: rezervimet, klientët, llogaritë, regjistri i auditimit, statistikat, çelësat e kufizimit (IP/email) | Privatësia §5 |
| 7 | Autoriteti mbikëqyrës dhe procedura e kërkesave të subjekteve | Privatësia §6 |
| 8 | Kushtet tregtare pas provës (çmimet, pagesa, vazhdimi) | Kushtet §3 |
| 9 | Procedura e pezullimit/njoftimit | Kushtet §3 |
| 10 | Kufizimi i përgjegjësisë | Kushtet §5 |
| 11 | Ligji i zbatueshëm dhe gjykata kompetente | Kushtet §7 |
| 12 | Afati i cookie-t të sesionit | Cookies §1 |

## Çfarë u verifikua në kod
- **Llogaritë**: email, hash fjalëkalimi, rol, verifikim email (kod/token si hash), rikuperim fjalëkalimi; hyrje me Google (NextAuth, JWT).
- **Rezervimet**: emri, mbiemri (ops.), telefoni, email (ops.), shënim (ops.), data/ora, persona, zona; lidhje me token;
  email konfirmimi + kujtesë 24h te mysafiri (nëse jep email) dhe njoftim te pronari — dërgim real vetëm me `EMAIL_SEND_LIVE=1`.
- **Analitika**: first-party, pa cookies e pa PII (restoranti, lloji, itemId, koha).
- **Kufizimi i tentativave**: IP (dhe email te ridërgimi i verifikimit) si çelës në tabelën `RateLimit`.
- **Auditimi**: email/rol i aktorit + veprimi.
- **Shërbime të jashtme**: Google Fonts (çdo faqe), OpenStreetMap tiles (harta), Cloudinary (foto), Resend (email), Google Sign-In,
  Google Maps/Wolt (vetëm me klikim).
- **Ruajtja në shfletues**: `localStorage` → `menu-lang`, `nextauth.message`.
- **Fshirje automatike me afat**: **nuk ekziston** në kod për asnjë nga të dhënat e mësipërme.

## Cookies dhe gjurmim — çfarë duhet zgjidhur para publikimit
1. **Cookies te vizitorët publikë**: `SessionProvider` (src/components/providers.tsx, në root layout) thërret `/api/auth/session`
   në çdo faqe; serveri vendos `next-auth.csrf-token` dhe `next-auth.callback-url` (HttpOnly) edhe për vizitorët pa llogari.
   Zgjidhje e mundshme: SessionProvider vetëm te `/login`, `/register`, `/dashboard`, `/admin`, `/onboarding`. Vendim produkti/ligjor.
2. **Google Fonts nga serverët e Google**: IP e vizitorit shkon te Google në çdo faqe. Alternativë: fonte të vetë-hostuara.
3. **Tile-t e OpenStreetMap**: politika e përdorimit të OSM s'lejon trafik të lartë prodhimi; zgjidhni ofrues.
4. Nuk u gjetën cookies reklamash/analitike nga palë të treta → **s'u shtua banner**. Banner-i s'është provë pajtueshmërie;
   vendimi pas shqyrtimit të pikave 1–3.
5. Deploy-et Preview të Vercel me mbrojtje përdorin cookie të platformës (`_vercel_jwt`) vetëm për stafin; jo në Production.
