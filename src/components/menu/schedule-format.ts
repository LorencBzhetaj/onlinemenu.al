import type { ScheduleDTO } from "@/lib/menu-types";

const DAY_LABELS = ["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht"];

export const DAY_OPTIONS = [
  { value: 1, label: "Hën" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mër" },
  { value: 4, label: "Enj" },
  { value: 5, label: "Pre" },
  { value: 6, label: "Sht" },
  { value: 0, label: "Die" },
];

/** Minuta → "HH:MM" (24h). 1440 → "24:00". */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minuta nga mesnata (0..1440). null nëse e pavlefshme. */
export function hhmmToMinutes(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 24 || mm > 59 || (h === 24 && mm !== 0)) return null;
  return h * 60 + mm;
}

/** Përmbledhje e lexueshme: "Hën–Pre · 07:00–11:00". */
export function formatSchedule(s: Pick<ScheduleDTO, "days" | "startMinutes" | "endMinutes">): string {
  const days = [...s.days].sort((a, z) => a - z).map((d) => DAY_LABELS[d]).join(", ");
  return `${days} · ${minutesToHHMM(s.startMinutes)}–${minutesToHHMM(s.endMinutes)}`;
}
