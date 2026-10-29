// Validim/normalizim i përbashkët i trupit të një menuje degustuese.
import type { Prisma } from "@prisma/client";

export type TastingData = {
  name: string;
  price: number;
  guestCount: number;
  courses: Prisma.InputJsonValue;
};

export function parseTastingBody(body: unknown): { data: TastingData } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const name = String(b.name ?? "").trim();
  if (!name) return { error: "Emri është i detyrueshëm." };

  const price = Math.trunc(Number(b.price));
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "Çmimi duhet të jetë numër i plotë më i madh se 0." };
  }

  const guestCount = Math.trunc(Number(b.guestCount));
  if (!Number.isFinite(guestCount) || guestCount <= 0) {
    return { error: "Numri i personave duhet të jetë më i madh se 0." };
  }

  const rawCourses = Array.isArray(b.courses) ? b.courses : [];
  const courses = rawCourses
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        titleAl: String(o.titleAl ?? "").trim(),
        titleEn: String(o.titleEn ?? "").trim(),
        descAl: String(o.descAl ?? "").trim(),
        descEn: String(o.descEn ?? "").trim(),
      };
    })
    .filter((c) => c.titleAl || c.titleEn || c.descAl || c.descEn);

  return { data: { name: name.slice(0, 120), price, guestCount, courses } };
}
