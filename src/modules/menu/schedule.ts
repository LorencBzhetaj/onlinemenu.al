// Logjika e orareve të menusë: a është një dritare kohore aktive TANI në Europe/Tirane.
// Kategoritë me orar shfaqen publikisht vetëm brenda dritares; pa orar → gjithmonë.

export type ScheduleWindow = {
  days: number[]; // 0=E Diel … 6=E Shtunë
  startMinutes: number; // 0..1439
  endMinutes: number; // 0..1440; nëse < startMinutes → kalon mesnatën
};

const TZ = "Europe/Tirane";

/** Minutat nga mesnata (0..1439) dhe dita e javës (0=Diel) për një instant në Europe/Tirane. */
export function tiraneNow(now: Date = new Date()): { day: number; minutes: number } {
  // Intl me timeZone jep orën lokale të Tiranës pa varësi nga ora e serverit.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wk: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = wk[get("weekday")] ?? 0;
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // disa platforma japin "24" për mesnatën
  const minute = parseInt(get("minute"), 10);
  return { day, minutes: hour * 60 + minute };
}

/** A bie `now` brenda dritares? Mbështet dritare që kalojnë mesnatën (end < start). */
export function isWindowActive(w: ScheduleWindow, now: Date = new Date()): boolean {
  const { day, minutes } = tiraneNow(now);
  const { startMinutes: s, endMinutes: e } = w;

  if (e > s) {
    // Dritare brenda të njëjtës ditë.
    return w.days.includes(day) && minutes >= s && minutes < e;
  }
  // Dritare që kalon mesnatën (p.sh. 22:00–02:00): aktive nëse
  //  - sot pas start-it (dita e start-it), ose
  //  - sot para end-it (dita pasardhëse e start-it).
  const prevDay = (day + 6) % 7;
  const afterStart = w.days.includes(day) && minutes >= s;
  const beforeEnd = w.days.includes(prevDay) && minutes < e;
  return afterStart || beforeEnd;
}
