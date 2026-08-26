// Regjistër i përbashkët për menaxhimin e abonimit (API + admin UI).

export const PLAN_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export const PLAN_OPTIONS: { key: string; label: string }[] = [
  { key: "monthly", label: "Mujor (+30 ditë)" },
  { key: "quarterly", label: "3-Mujor (+90 ditë)" },
  { key: "yearly", label: "Vjetor (+365 ditë)" },
];

export const STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: "trial", label: "Trial" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
];

export const ALLOWED_STATUS = new Set(["trial", "active", "expired", "cancelled"]);
export const ALLOWED_PLAN = new Set(["monthly", "quarterly", "yearly"]);

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Llogarit datën e re të skadimit.
 * KRITIKE: për "active"/"trial" llogaritet NGA SOT (jo nga skadimi i vjetër),
 * që restorantët e skaduar prej kohësh të mos marrin skadim të gabuar.
 * Për "expired"/"cancelled" ruhet skadimi ekzistues (vetëm statusi ndryshon).
 */
export function computeExpiresAt(
  status: string,
  plan: string,
  existingExpiresAt: Date | null
): Date {
  const now = new Date();
  if (status === "active") return addDays(now, PLAN_DAYS[plan] ?? 30);
  if (status === "trial") return addDays(now, 30);
  return existingExpiresAt ?? now;
}

/** Ditë të mbetura (pozitive) ose të kaluara që kur ka skaduar (negative). */
export function daysUntil(date: Date): number {
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
