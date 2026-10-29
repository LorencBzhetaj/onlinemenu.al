// Tema e faqeve publike (profil/menu/informacion) nga brandi i restorantit.
// Brandi ka përparësi brenda faqes së tij; platforma mbetet diskrete.
import { mixHex, lighten } from "@/lib/color";
import { googleFontsHref, DEFAULT_HEADING, DEFAULT_BODY } from "@/lib/branding";

export type ThemeSource = {
  primaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
};

const DEF_PRIMARY = "#0f1720";
const DEF_ACCENT = "#c9a24b";

/** CSS variables për brandin — superset për menu.css DHE për faqet profil/info. */
export function publicThemeVars(r: ThemeSource): React.CSSProperties {
  const primary = r.primaryColor ?? DEF_PRIMARY;
  const accent = r.accentColor ?? DEF_ACCENT;
  const fontHeading = r.fontHeading ?? DEFAULT_HEADING;
  const fontBody = r.fontBody ?? DEFAULT_BODY;

  return {
    // Variablat e menu.css (faqja e menusë).
    "--charcoal": primary,
    "--ink": primary,
    "--gold": accent,
    "--gold-soft": lighten(accent, 0.5),
    "--iris-deep": primary,
    "--olive-dark": mixHex(accent, primary, 0.35),
    "--hero-bg": `linear-gradient(160deg, ${primary} 0%, ${mixHex(primary, accent, 0.5)} 55%, ${accent} 100%)`,
    "--font-display": `"${fontHeading}", serif`,
    "--font-body": `"${fontBody}", serif`,
    // Variabla gjenerike brandi (profil/info).
    "--brand": primary,
    "--brand-soft": lighten(primary, 0.88),
    "--accent": accent,
    "--accent-ink": mixHex(accent, "#000000", 0.35),
  } as React.CSSProperties;
}

/** URL-ja e Google Fonts për fontet e restorantit + fontet ndihmëse (script/UI). */
export function publicFontsHref(r: ThemeSource): string {
  return googleFontsHref([
    r.fontHeading ?? DEFAULT_HEADING,
    r.fontBody ?? DEFAULT_BODY,
    "Dancing Script",
    "Jost",
  ]);
}
