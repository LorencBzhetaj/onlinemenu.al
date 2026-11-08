// Paleta e vetme e miratuar e OnlineMenu.al (faqet publike). Burimi i vetëm i ngjyrave:
// tailwind (`om.*`), globals.css (`--om-*`) dhe publicThemeVars() i lexojnë nga këtu ose i pasqyrojnë.
//
// Rregullat e kontrastit (WCAG AA):
//  - Butter Yellow dhe Candy Pink janë SFONDE ose theks; teksti mbi to është Aubergine.
//  - Asnjëra nuk përdoret si ngjyrë teksti mbi Warm White / të bardhë (s'arrin 4.5:1).
//  - Teksti dytësor është `inkSoft` (~6.8:1 mbi Warm White).
export const OM = {
  butter: "#FFE16A", // veprimi Rezervo + zgjedhjet aktive
  butterSoft: "#FFF1B8",
  aubergine: "#4C1845", // teksti + brandi
  aubergineDeep: "#3A1035",
  pink: "#FF79BD", // thekse
  pinkSoft: "#FFE1F0",
  white: "#FFF8EE", // Warm White — sipërfaqet
  surface: "#FFFFFF",
  inkSoft: "#6E4D68",
  line: "#EEDFD3",
  // Wolt: buton blu cyan, tekst i errët që të lexohet (≈5:1).
  woltCyan: "#009DE0",
  woltInk: "#00243A",
} as const;

export const OM_FONT_DISPLAY = "Fredoka";
export const OM_FONT_BODY = "Nunito";

/** Google Fonts për faqet publike (titujt e rrumbullakët + teksti). */
export const OM_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap";
