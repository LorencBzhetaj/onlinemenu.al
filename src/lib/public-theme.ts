// Tema e faqeve publike (profil/menu/informacion/rezervim).
//
// Ridizajnimi i miratuar përdor NJË paletë të vetme për të gjitha restorantet (OnlineMenu.al).
// Identiteti i restorantit mbetet te logoja, emri dhe përmbajtja; ngjyrat/fontet e ruajtura te
// Restaurant.primaryColor/accentColor/fontHeading/fontBody NUK aplikohen më në faqet publike
// (të dhënat mbeten në DB dhe në panel, pa ndryshim).
import { OM, OM_FONT_BODY, OM_FONT_DISPLAY, OM_FONTS_HREF } from "@/lib/om-theme";

export type ThemeSource = {
  primaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
};

/**
 * CSS variables për menu.css + profile.css, të vendosura nga paleta e miratuar.
 * Parametri pranohet për përputhshmëri me thirrjet ekzistuese; brandi i restorantit s'aplikohet.
 */
export function publicThemeVars(_r?: ThemeSource): React.CSSProperties {
  void _r;
  return {
    // Sipërfaqet + teksti.
    "--cream": OM.white,
    "--paper": OM.surface,
    "--ink": OM.aubergine,
    "--ink-soft": OM.inkSoft,
    "--line": "rgba(76, 24, 69, 0.14)",
    "--shadow": "0 10px 28px rgba(76, 24, 69, 0.08)",
    // Variablat e menu.css: header/çmime mbi Aubergine me tekst Butter.
    "--charcoal": OM.aubergine,
    "--gold": OM.butter,
    "--gold-soft": OM.butter,
    "--iris-deep": OM.aubergine,
    "--olive-dark": OM.inkSoft,
    "--hero-bg": OM.pink,
    // Variabla gjenerike (profil/info/rezervim).
    "--brand": OM.aubergine,
    "--brand-soft": OM.pinkSoft,
    "--accent": OM.pink,
    "--accent-ink": OM.aubergine,
    // Fontet.
    "--font-display": `"${OM_FONT_DISPLAY}", system-ui, sans-serif`,
    "--font-body": `"${OM_FONT_BODY}", system-ui, sans-serif`,
    "--font-ui": `"${OM_FONT_BODY}", system-ui, sans-serif`,
    "--font-script": `"${OM_FONT_DISPLAY}", system-ui, sans-serif`,
  } as React.CSSProperties;
}

/** URL-ja e Google Fonts për faqet publike (e njëjtë për të gjitha restorantet). */
export function publicFontsHref(_r?: ThemeSource): string {
  void _r;
  return OM_FONTS_HREF;
}
