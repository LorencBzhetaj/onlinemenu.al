export function parseAllergen(
  body: unknown
): { data: { nameAl: string; nameEn: string; icon: string | null } } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const nameAl = String(b.nameAl ?? "").trim();
  const nameEn = String(b.nameEn ?? "").trim();
  if (!nameAl || !nameEn) return { error: "Emri (AL) dhe (EN) janë të detyrueshëm." };
  const icon = b.icon ? String(b.icon).trim().slice(0, 8) : null;
  return { data: { nameAl: nameAl.slice(0, 40), nameEn: nameEn.slice(0, 40), icon } };
}
