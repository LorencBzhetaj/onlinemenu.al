# Auditi vizual: llogaria, onboarding, paneli, admin-i

Pamjet (lokale, DB Docker sintetike): `docs/redesign/screenshots/audit/` — telefon 390×844 dhe desktop 1366×900.

| Faqja | Tema sot | Gjendja |
|---|---|---|
| `/account` | OnlineMenu.al (Butter/Aubergine, Fredoka/Nunito) | ✅ e harmonizuar. U rregullua: header-i tregonte "Hyr" për përdoruesin e kyçur dhe s'kishte dalje → tani "Llogaria ime" + "Dil nga llogaria". |
| `/login`, `/register`, `/onboarding` | e vjetër (krem/jeshile, Playfair/Jost) | ❌ |
| `/dashboard/*` (përfshi Njoftime) | e vjetër, emri "MenuDigjitale" | ❌ |
| `/admin/*` | e vjetër, "Admin·Panel" | ❌ |
| Email-et (verifikim, rivendosje, njoftime) | "MenuDigjitale", ar/blu e errët | ❌ |
| Titulli i dritares | "… · MenuDigjitale" | ❌ |

## Propozimi (pa e zbatuar ende)

Paneli përdor vetëm token-a semantikë (`canvas`, `surface`, `ink`, `muted`, `line`, `primary`, `accent`,
`font-display`, `font-ui`), ndaj harmonizimi bëhet kryesisht duke ndryshuar vlerat e token-ave, pa prekur 47 skedarët.

| Token | Sot | Propozim |
|---|---|---|
| `canvas` | #FAF8F3 | #FFF8EE (Warm White) |
| `surface` | #FFFFFF | #FFFFFF |
| `ink` | #20241F | #3A1035 (Aubergine deep) |
| `muted` | #62685F | #6E4D68 |
| `line` | #E8E3D7 | #EEDFD3 |
| `primary` | #164B36 jeshile | #4C1845 Aubergine (tekst i bardhë, kontrast ~12:1) |
| `primary.dark` | #0F3A29 | #3A1035 |
| `primary.soft` | #E7EFEA | #FFF1B8 (Butter soft — nav aktiv, badge) |
| `accent` | #A77932 ar | #FF79BD Pink (vetëm dekor, kurrë tekst i vogël) |
| `font-display` / `font-heading` | Playfair Display | Fredoka |
| `font-ui` / `font-body` | Jost | Nunito |

Plus ndryshime të vogla manuale:
1. Emri dhe shenja: "MenuDigjitale" → logo-chef + "OnlineMenu.al" në `dashboard-nav`, `admin/layout`, `layout.tsx` (titulli).
2. Badge "trial" (blu) → Butter me tekst Aubergine; statuset e tjera (aktiv/skaduar) me ngjyrat ekzistuese të suksesit/gabimit.
3. Butoni kryesor: Butter me tekst Aubergine (si "Regjistro biznesin") për veprimin kryesor të faqes; Aubergine për butonat e zakonshëm.
4. Fokusi: unaza Aubergine 2px (sot jeshile).
5. Email-et: sfond i bardhë, titull Aubergine, buton Butter; "OnlineMenu.al". `EMAIL_FROM` mbetet siç është derisa të verifikohet domeni.
6. Rreshti "Google · Jo i lidhur" te `/account` ka hapësirë të tepërt poshtë (kozmetike).

Rrezik: `font-heading`/`font-body` përdoren edhe në 16 skedarë jashtë panelit (login, register, onboarding, invite) — kjo është
e dëshirueshme (i harmonizon njëkohësisht). Faqja publike e menusë `/m/[slug]` përdor `midnight`/`alpine` dhe nuk preket;
faqet publike përdorin `om-*` dhe nuk preken.

Verifikimi pas zbatimit: kontrast WCAG AA për `muted` mbi `canvas`, pamjet e njëjta në të dyja madhësitë, `npm test` + build.
