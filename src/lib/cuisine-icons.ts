// Lidhja e kuzhinave (tekst i lirë te Restaurant.cuisine) me ikonat e Shefit të Bukës
// (public/brand/kategorite/*.webp). Emri normalizohet (ë/e, ç/c, shkronja të vogla) dhe
// krahasohet me fjalë kyçe; e panjohura → ikona rezervë.
import { normalizeForSearch } from "@/lib/text-normalize";

export type CuisineIconKey =
  | "tradicionale"
  | "fast-food"
  | "burgers"
  | "sufllaqe"
  | "pizza"
  | "peshku"
  | "vegan"
  | "embelsira"
  | "kafe"
  | "zgare"
  | "mengjes"
  | "pasta";

// Rendi ka rëndësi: më specifiket para më të përgjithshmeve (p.sh. "sufllaqe" para "fast food").
const RULES: [CuisineIconKey, RegExp][] = [
  ["sufllaqe", /sufllaq|souvlak|gyro|doner|qebap|kebab|pita/],
  ["burgers", /burger/],
  ["pizza", /pic+a|pizz/],
  ["pasta", /pasta|makarona|italian/],
  ["fast-food", /fast ?food|street ?food/],
  ["peshku", /peshk|fish|deti|seafood|fruta deti/],
  ["zgare", /zgar|grill|mish|steak|bbq/],
  ["vegan", /vegan|vegjet|sallat|salad|fresk|healthy/],
  ["embelsira", /embelsir|embel|pastic|dessert|tort|akullore|gelato/],
  ["kafe", /kafe|coffee|kafene|bar\b|cafe/],
  ["mengjes", /mengjes|breakfast|brunch/],
  ["tradicionale", /tradicional|shqiptar|shtepi|zgara shqiptare|traditional|albanian/],
];

export const CUISINE_ICON_FALLBACK = "/brand/kategorite/te-gjitha.webp";

export function cuisineIconKey(cuisine: string): CuisineIconKey | null {
  const n = normalizeForSearch(cuisine);
  for (const [key, re] of RULES) if (re.test(n)) return key;
  return null;
}

export function cuisineIconSrc(cuisine: string): string {
  const k = cuisineIconKey(cuisine);
  return k ? `/brand/kategorite/${k}.webp` : CUISINE_ICON_FALLBACK;
}
