// Kthimi i sigurt nga menuja: pranon VETËM rrugë të brendshme të katalogut/profilit.
// Asnjë URL e jashtme, protokoll, "//host" apo backslash nuk pranohet nga parametri `from`.

const ALLOWED = [/^\/$/, /^\/restaurants$/, /^\/restaurants\/[a-z0-9-]+$/];

export function safeReturnPath(raw: string | string[] | undefined | null): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || v.length > 400) return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  let u: URL;
  try {
    u = new URL(v, "http://internal.invalid");
  } catch {
    return null;
  }
  if (u.origin !== "http://internal.invalid") return null;
  if (!ALLOWED.some((re) => re.test(u.pathname))) return null;
  // Ruaj vetëm parametrat e katalogut (kërkimi, qyteti, kuzhina, faqja).
  const keep = new URLSearchParams();
  for (const k of ["q", "city", "cuisine", "page"]) {
    const val = u.searchParams.get(k);
    if (val) keep.set(k, val.slice(0, 80));
  }
  const qs = keep.toString();
  return qs ? `${u.pathname}?${qs}` : u.pathname;
}

/** Ndërton lidhjen e menusë me kthim te `from` (kur jepet). */
export function menuHref(slug: string, from?: string | null): string {
  const base = `/restaurants/${slug}/menu`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
}
