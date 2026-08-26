// Regjistri i përbashkët i brandimit: fontet e lejuara, temat e gatshme, dhe
// ndihmësit për validim + ndërtim të URL-së së Google Fonts.
// Përdoret nga dashboard-i (branding-form), API route dhe faqja publike.

export type FontOption = { label: string; family: string };

export const HEADING_FONTS: FontOption[] = [
  { label: "Playfair Display", family: "Playfair Display" },
  { label: "Cormorant Garamond", family: "Cormorant Garamond" },
  { label: "Dancing Script", family: "Dancing Script" },
  { label: "Fraunces", family: "Fraunces" },
  { label: "Cormorant Infant", family: "Cormorant Infant" },
];

export const BODY_FONTS: FontOption[] = [
  { label: "Cormorant Garamond", family: "Cormorant Garamond" },
  { label: "Jost", family: "Jost" },
  { label: "EB Garamond", family: "EB Garamond" },
  { label: "Work Sans", family: "Work Sans" },
];

export const DEFAULT_HEADING = "Playfair Display";
export const DEFAULT_BODY = "Cormorant Garamond";

/** Bashkësia e familjeve të lejuara (për validim në API). */
export const ALLOWED_FONTS = new Set(
  [...HEADING_FONTS, ...BODY_FONTS].map((f) => f.family)
);

export type ThemePreset = { name: string; primary: string; accent: string };

export const THEME_PRESETS: ThemePreset[] = [
  { name: "Iris & Ulli", primary: "#2e2640", accent: "#a3b18a" },
  { name: "Mesnatë Alpine", primary: "#0f1720", accent: "#c9a24b" },
  { name: "Dheu i Malit", primary: "#2c211a", accent: "#b07d52" },
  { name: "Minimale e Zezë", primary: "#0d0d0d", accent: "#bfa980" },
  { name: "Pyll Dimëror", primary: "#14231d", accent: "#7fa891" },
  { name: "Hibrid Mesnatë+Dheu", primary: "#16202a", accent: "#b08d57" },
];

// Stili i fotos në menunë publike (zgjidhet nga pronari te Personalizim).
export type MenuPhotoStyle = "large" | "thumbnail" | "none";

export const MENU_PHOTO_STYLES: { key: MenuPhotoStyle; label: string; hint: string }[] = [
  { key: "large", label: "Foto e madhe", hint: "Imazhi sipër kartës, full-width" },
  { key: "thumbnail", label: "Miniaturë", hint: "Foto e vogël anash tekstit" },
  { key: "none", label: "Pa foto", hint: "Vetëm tekst (elegante, e dendur)" },
];

export const ALLOWED_PHOTO_STYLES = new Set<string>(["large", "thumbnail", "none"]);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHex(v: string): boolean {
  return HEX_RE.test(v);
}

/**
 * Ndërton URL-në e stylesheet-it të Google Fonts për familjet e dhëna.
 * P.sh. ["Playfair Display", "Jost"] ->
 *   https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Jost:wght@400;600;700&display=swap
 */
export function googleFontsHref(families: string[]): string {
  const unique = Array.from(new Set(families.filter(Boolean)));
  const params = unique
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/** Inicialet e emrit për fallback logoje (deri 2 shkronja). */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
