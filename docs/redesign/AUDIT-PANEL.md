# Marka në llogari, panel, admin dhe email — dhe hierarkia vizuale

Pamjet (lokale, të dhëna sintetike): `docs/redesign/screenshots/hierarchy/` — telefon 390×844 dhe desktop 1366×900.
Pamjet e vjetra (tema jeshile, para ndryshimit): `docs/redesign/screenshots/audit/`.

## Çfarë u aplikua
| Zona | Ndryshimi |
|---|---|
| Token-at e platformës (`tailwind.config.ts`, `globals.css`) | canvas #FFF8EE · ink #3A1035 · muted #6E4D68 · line #EEDFD3 · primary Aubergine #4C1845 · primary-soft Butter #FFF1B8 · accent Pink (vetëm dekor) · Fredoka/Nunito |
| Statuset | Sukses = jeshile (`green-100/800`), paralajmërim = portokalli (`amber-100/900`), gabim = e kuqe (`red-100/800`), "provë falas" = Butter. Statuset e rezervimeve mbeten me ngjyra të veçanta dhe tani në shqip |
| Paneli dhe admin-i | Logoja + "OnlineMenu.al" + etiketë "Paneli"/"Admin" (`platform-brand.tsx`); titulli i dritares "… · OnlineMenu.al" |
| Hyrja, regjistrimi, onboarding, rivendosja | Shenja e markës mbi titull (`auth-brand.tsx`) |
| Email-et e llogarisë | Sfond Warm White, titull Aubergine, buton Butter me tekst Aubergine, "OnlineMenu.al" |
| Header-i publik | "Llogaria ime" për përdoruesin e kyçur në të gjitha faqet publike (`om-account-link.tsx`, lexon sesionin në klient) |
| Checkbox/radio | `accent-color` Aubergine |

Faqet publike të restorantit (`.rprofile`, `.qr-menu`) kanë fontet dhe ngjyrat në scope-in e tyre dhe s'preken nga token-at e platformës.

## Hierarkia faqe pas faqeje — gjetje dhe korrigjime
| Faqja | Gjetja | Korrigjimi |
|---|---|---|
| Menuja publike (telefon) | Ilustrimi 120 px + titulli 2.1rem shtynin pjatat poshtë | Hyrje kompakte në ≤640 px (ilustrim 84 px, titull 1.55rem) |
| Menuja publike | Vija dekorative dhe hapësirë bosh te pjatat pa përshkrim | Vija shfaqet vetëm kur ka përshkrim |
| Paneli → Menu | Çmimet "700 L" ndërsa publiku shfaq "ALL"; menuja degustuese "LEK" | Kudo "ALL" |
| Paneli (telefon) | Menuja horizontale s'tregonte faqen aktive (p.sh. Rezervime jashtë ekranit) | Lëviz vetë te faqja aktive |
| Paneli → Rezervime | Statuset në anglisht (Confirmed, NoShow…) | Konfirmuar · Në tryezë · Përfunduar · S’erdhi · Anuluar |
| Rezervimi i klientit | Statusi "I konfirmuar" në ngjyrë ari | Jeshile (sukses) |
| Anulimi | `confirm()` i shfletuesit | Dialog `<dialog>` modal: fokus te "Jo, mbaje", Tab/Enter/Esc, fokusi kthehet te butoni; "Po, anuloje" tekst i bardhë mbi #B4461F |
| Hyrja/regjistrimi | Pa shenjë marke mbi formular | Logoja + emri |

### Katër vërejtjet e raundit të kaluar (të korrigjuara më 2026-11-13)
| # | Gjetja | Ndikimi | Prioriteti |
|---|---|---|---|
| 1 | Paneli → Menu: ikonat shiko/ndrysho/fshi janë ~20 px, nën 44 px për prekje; fshirja është pranë ndryshimit | Prekje të gabuara në telefon (edhe fshirje aksidentale); WCAG 2.5.5/2.5.8 | **I lartë** — pronari e përdor çdo ditë nga telefoni |
| 2 | Profili publik në desktop: shiriti lundrues (Restoranti/Menuja/Informacion) mbulon footer-in në fund të faqes | Lidhjet ligjore të footer-it mbulohen pjesërisht; s'prek telefonin | **Mesatar** |
| 3 | Paneli → Rezervime: "Duke ngarkuar…" pa skelet; data shfaqet sipas gjuhës së shfletuesit (p.sh. MM/DD/YYYY) | Kërcim i faqes gjatë ngarkimit; datë e paqartë për stafin me shfletues në anglisht | **Mesatar** |
| 4 | Profili pa foto/informacion: kolona e majtë në desktop mbetet bosh | Vetëm estetikë, kur restoranti s'ka plotësuar profilin | **I ulët** |

Korrigjimet: (1) butonat e artikujve dhe të kategorive ≥44 px me etiketa, fshirja e ndarë, rreshtat kalojnë në dy rreshta në telefon;
(2) footer-i merr hapësirë poshtë kur ka shiritin e fiksuar (72 px telefon, 96 px desktop); (3) skelet ngarkimi + data në shqip
("e premte, 13 nëntor 2026") te Rezervime; (4) profili pa përmbajtje kryesore përdor një kolonë, pa hapësirë bosh.
