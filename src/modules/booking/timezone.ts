/**
 * Zona e biznesit — konvertim i qartë IANA (i përshtatur nga repo `restorant`).
 *
 * Çdo restorant punon në një zonë (default Europe/Tirane, e ruajtur te
 * BookingSettings.timezone). I gjithë motori interpreton orët wall-clock në atë
 * zonë PAVARËSISHT nga ora e procesit/runtime-it (serverless = UTC). Asnjë varësi
 * nga ora e host-it: çdo konvertim ankorohet te një zonë IANA e qartë përmes Intl,
 * që funksionon njësoj në Node, serverless dhe edge. DST trajtohet saktë.
 */

export const DEFAULT_BUSINESS_TZ = "Europe/Tirane";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function isValidTimeZone(tz: string | undefined | null): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Zona e vlefshme ose default-i. */
export function resolveTimeZone(tz?: string | null): string {
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_BUSINESS_TZ;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0=Sun … 6=Sat
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Pjesët wall-clock të një instanti absolut, siç shihen në `timeZone`. */
export function zonedParts(instant: Date, timeZone: string = DEFAULT_BUSINESS_TZ): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  };
}

/**
 * Konverton wall-clock në `timeZone` → instanti absolut UTC. Përdor offset-probe:
 * rendon një "guess" UTC në zonë, mat sa larg është zona nga UTC në atë instant,
 * pastaj korrigjon. DST-korrekt (offset-i llogaritet për datën specifike).
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  second = 0,
  timeZone: string = DEFAULT_BUSINESS_TZ
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetAt = (utcMs: number): number => {
    const p = zonedParts(new Date(utcMs), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
  };
  const offset1 = offsetAt(target);
  let result = target - offset1;
  const offset2 = offsetAt(result);
  if (offset2 !== offset1) result = target - offset2;
  return new Date(result);
}

/** Instanti absolut për "YYYY-MM-DD" + minuta-të-ditës, në zonën e biznesit. */
export function businessDateAtMinutes(dateKey: string, minutes: number, timeZone: string = DEFAULT_BUSINESS_TZ): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return zonedTimeToUtc(y, m, d, 0, minutes, 0, timeZone);
}

/** "YYYY-MM-DD" për një instant, në zonën e biznesit. */
export function toBusinessDateKey(instant: Date, timeZone: string = DEFAULT_BUSINESS_TZ): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** "HH:mm" për një instant, në zonën e biznesit. */
export function businessTimeOfDay(instant: Date, timeZone: string = DEFAULT_BUSINESS_TZ): string {
  const p = zonedParts(instant, timeZone);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Dita e javës (0=Diel) për një instant, në zonën e biznesit. */
export function businessDayOfWeek(instant: Date, timeZone: string = DEFAULT_BUSINESS_TZ): number {
  return zonedParts(instant, timeZone).weekday;
}

/** Minuta-e-ditës (0-1439) për një instant, në zonën e biznesit. */
export function businessMinutesOfDay(instant: Date, timeZone: string = DEFAULT_BUSINESS_TZ): number {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

export { pad2 };
