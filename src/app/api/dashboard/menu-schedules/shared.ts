export type ScheduleData = { label: string; days: number[]; startMinutes: number; endMinutes: number };

export function parseSchedule(body: unknown): { data: ScheduleData } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const label = String(b.label ?? "").trim();
  if (!label) return { error: "Emri i orarit është i detyrueshëm." };

  const rawDays = Array.isArray(b.days) ? b.days : [];
  const days = Array.from(
    new Set(rawDays.map((d) => Math.trunc(Number(d))).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  ).sort((a, z) => a - z);
  if (days.length === 0) return { error: "Zgjidh të paktën një ditë." };

  const startMinutes = Math.trunc(Number(b.startMinutes));
  const endMinutes = Math.trunc(Number(b.endMinutes));
  const valid = (m: number) => Number.isFinite(m) && m >= 0 && m <= 1440;
  if (!valid(startMinutes) || !valid(endMinutes)) {
    return { error: "Orët duhet të jenë brenda 00:00–24:00." };
  }
  if (startMinutes === endMinutes) {
    return { error: "Ora e fillimit dhe e mbarimit s'mund të jenë të njëjta." };
  }

  return { data: { label: label.slice(0, 60), days, startMinutes, endMinutes } };
}
