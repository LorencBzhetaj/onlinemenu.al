// Normalizim për kërkimin e emrave: pa dallim shkronjash të mëdha/vogla dhe me përputhje
// të shkronjave shqipe me theks (ë→e, ç→c, si dhe çdo diakritik tjetër përmes NFD).

export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Renditja e përputhjes së emrit (më e vogla = më e mirë), ose null kur s'përputhet:
 *  0 = emri fillon me kërkimin ("bo" → "Bora")
 *  1 = një fjalë e emrit fillon me kërkimin ("bo" → "Bistro Bota")
 *  2 = kërkimi ndodhet diku tjetër në emër ("bo" → "Kebabo")
 */
export function nameMatchRank(name: string, query: string): number | null {
  const n = normalizeForSearch(name);
  const q = normalizeForSearch(query);
  if (!q) return null;
  if (n.startsWith(q)) return 0;
  if (n.split(/[\s\-–—/&.,'’()]+/).some((w) => w.startsWith(q))) return 1;
  if (n.includes(q)) return 2;
  return null;
}
