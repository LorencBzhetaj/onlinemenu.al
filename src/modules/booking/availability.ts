import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  businessDateAtMinutes,
  businessDayOfWeek,
  businessMinutesOfDay,
  businessTimeOfDay,
  toBusinessDateKey,
  resolveTimeZone,
  pad2,
} from "./timezone";

/**
 * MOTORI I DISPONUESHMËRISË (multi-tenant, i përshtatur nga repo `restorant`).
 * ----------------------------------------------------------------------------
 * Një orë është e rezervueshme për një grup vetëm kur të paktën NJË tavolinë aktive
 * (ose kombinim i kuruar) e të njëjtit restorant:
 *   - ka vende të mjaftueshme (seats >= partySize)
 *   - fillon brenda një periudhe hapjeje, në/para orës së fundit të lejuar
 *     (mbyllja është kufi inclusive i fillimit; "lastBookingTime" mund ta kapë më herët;
 *     rezervimi MUND të vazhdojë pas mbylljes — kohëzgjatja cakton vetëm sa mbahet tavolina)
 *   - nuk bie brenda një mbylljeje restoranti/zone
 *   - është e lirë për gjithë seancën, duke respektuar buffer-in mes rezervimeve
 *   - nuk është në të kaluarën
 *
 * ÇDO query filtrohet me restaurantId (izolim tenant).
 */

export interface Settings {
  turnDurationMinutes: number;
  bookingInterval: number;
  seatingBuffer: number;
  maxPartySize: number;
  timezone: string;
}

export interface TableAvailability {
  tableId: string;
  status: "free" | "occupied" | "tooSmall" | "inactive";
}

export interface TimeSlot {
  time: string; // "HH:mm"
  start: string; // ISO
  freeTables: number;
}

interface Period {
  start: number; // minuta nga mesnata
  end: number;
  lastStart: number; // minuta e fundit e lejuar e fillimit (inclusive)
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Politikat e booking-ut për restorantin (me default-e kur mungon rreshti). */
export async function getSettings(restaurantId: string): Promise<Settings> {
  const s = await prisma.bookingSettings.findUnique({ where: { restaurantId } });
  return {
    turnDurationMinutes: s?.turnDurationMinutes ?? 120,
    bookingInterval: s?.bookingInterval ?? 30,
    seatingBuffer: s?.seatingBuffer ?? 15,
    maxPartySize: s?.maxPartySize ?? 12,
    timezone: resolveTimeZone(s?.timezone),
  };
}

export interface SlotCaps {
  defaultMaxRes: number; // 0 = pa kufi
  defaultMaxCovers: number; // 0 = pa kufi
  limits: { dayOfWeek: number | null; time: string; areaKind: string | null; maxReservations: number; maxCovers: number | null }[];
}

export async function getSlotCaps(restaurantId: string): Promise<SlotCaps> {
  const s = await prisma.bookingSettings.findUnique({ where: { restaurantId } });
  const limits = await prisma.slotLimit.findMany({ where: { restaurantId } });
  return {
    defaultMaxRes: s?.maxReservationsPerSlot ?? 0,
    defaultMaxCovers: s?.maxCoversPerSlot ?? 0,
    limits: limits.map((l) => ({
      dayOfWeek: l.dayOfWeek,
      time: l.time,
      areaKind: l.areaKind,
      maxReservations: l.maxReservations,
      maxCovers: l.maxCovers,
    })),
  };
}

/** Kufijtë për një ditë+orë, të scope-uar sipas llojit të zonës. */
export function capForSlot(
  caps: SlotCaps,
  dayOfWeek: number,
  time: string,
  areaKind: string | null = null
): { maxRes: number; maxCovers: number } {
  const matches = caps.limits
    .filter((l) => l.time === time && (l.areaKind ?? null) === (areaKind ?? null) && (l.dayOfWeek === null || l.dayOfWeek === dayOfWeek))
    .sort((a, b) => (a.dayOfWeek === null ? 1 : 0) - (b.dayOfWeek === null ? 1 : 0));
  const chosen = matches[0];
  if (chosen) return { maxRes: chosen.maxReservations, maxCovers: chosen.maxCovers ?? (areaKind === null ? caps.defaultMaxCovers : 0) };
  if (areaKind === null) return { maxRes: caps.defaultMaxRes, maxCovers: caps.defaultMaxCovers };
  return { maxRes: 0, maxCovers: 0 };
}

export interface AreaInfo {
  id: string;
  name: string;
  kind: string;
  isOpen: boolean;
  weatherDependent: boolean;
  priority: number;
}

export async function getAreas(restaurantId: string): Promise<AreaInfo[]> {
  const areas = await prisma.area.findMany({ where: { restaurantId }, orderBy: [{ priority: "asc" }, { sortOrder: "asc" }] });
  return areas.map((a) => ({ id: a.id, name: a.name, kind: a.kind, isOpen: a.isOpen, weatherDependent: a.weatherDependent, priority: a.priority }));
}

export type RequestedArea = "indoor" | "outdoor" | "no_preference";

function bookableAreaIds(areas: AreaInfo[], requestedArea: RequestedArea): Set<string> {
  return new Set(
    areas.filter((a) => a.isOpen && (requestedArea === "no_preference" || a.kind === requestedArea)).map((a) => a.id)
  );
}

async function getPeriodsForDay(restaurantId: string, dayOfWeek: number): Promise<Period[]> {
  const hours = await prisma.openingHour.findMany({ where: { restaurantId, dayOfWeek, isActive: true } });
  return hours
    .map((h) => {
      const start = hhmmToMinutes(h.startTime);
      const end = hhmmToMinutes(h.endTime);
      const lbt = h.lastBookingTime ? hhmmToMinutes(h.lastBookingTime) : null;
      const lastStart = lbt != null ? Math.min(lbt, end) : end;
      return { start, end, lastStart };
    })
    .sort((a, b) => a.start - b.start);
}

async function isClosedOn(restaurantId: string, dateKey: string, tz: string): Promise<boolean> {
  const closures = await prisma.closure.findMany({ where: { restaurantId } });
  return closures.some((c) => {
    const cs = toBusinessDateKey(new Date(c.startDate), tz);
    const ce = toBusinessDateKey(new Date(c.endDate), tz);
    return dateKey >= cs && dateKey <= ce;
  });
}

export interface AreaClosureRange {
  areaId: string;
  startDateTime: Date;
  endDateTime: Date;
}

/** Pure: a është `areaId` e mbyllur për ndonjë pjesë të [slotStart, slotEnd)? */
export function areaClosedAtSlot(closures: AreaClosureRange[], areaId: string | null, slotStart: Date, slotEnd: Date): boolean {
  if (!areaId) return false;
  return closures.some((c) => c.areaId === areaId && overlaps(slotStart, slotEnd, new Date(c.startDateTime), new Date(c.endDateTime)));
}

async function getAreaClosuresInRange(restaurantId: string, rangeStart: Date, rangeEnd: Date): Promise<AreaClosureRange[]> {
  return prisma.areaClosure.findMany({
    where: { restaurantId, startDateTime: { lt: rangeEnd }, endDateTime: { gt: rangeStart } },
    select: { areaId: true, startDateTime: true, endDateTime: true },
  });
}

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface Occupancy {
  tableId: string;
  start: Date;
  end: Date;
}

/**
 * Çdo (tableId, start, end) që mbahet nga një rezervim aktiv i KËTIJ restoranti në
 * dritare. Një rezervim me kombinim kontribon një rresht për tavolinë anëtare, pra
 * një rezervim bllokon TË GJITHA tavolinat e veta (via ReservationTable).
 */
async function getOccupanciesInRange(
  client: DbClient,
  restaurantId: string,
  rangeStart: Date,
  rangeEnd: Date,
  ignoreReservationId?: string
): Promise<Occupancy[]> {
  const rows = await client.reservationTable.findMany({
    where: {
      reservation: {
        restaurantId,
        status: { notIn: ["Cancelled", "NoShow"] },
        startDateTime: { lte: rangeEnd },
        endDateTime: { gte: rangeStart },
        ...(ignoreReservationId ? { id: { not: ignoreReservationId } } : {}),
      },
    },
    select: { tableId: true, reservation: { select: { startDateTime: true, endDateTime: true } } },
  });
  return rows.map((r) => ({ tableId: r.tableId, start: r.reservation.startDateTime, end: r.reservation.endDateTime }));
}

function tableClashes(occupancies: Occupancy[], tableId: string, start: Date, end: Date, bufferMs: number): boolean {
  return occupancies.some(
    (o) => o.tableId === tableId && overlaps(start, end, new Date(new Date(o.start).getTime() - bufferMs), new Date(new Date(o.end).getTime() + bufferMs))
  );
}

export interface EligibleCombination {
  id: string;
  areaId: string;
  areaKind: string | null;
  maxSeats: number;
  minSeats: number | null;
  priority: number;
  memberTableIds: string[];
}

/** Kombinime aktive që mund të ulin `partySize` në një zonë të rezervueshme, të validuara. */
async function getEligibleCombinations(
  client: DbClient,
  restaurantId: string,
  partySize: number,
  openAreaIds: Set<string>
): Promise<EligibleCombination[]> {
  const areas = await client.area.findMany({ where: { restaurantId }, select: { id: true, kind: true } });
  const kindOf = new Map(areas.map((a) => [a.id, a.kind]));
  const combos = await client.tableCombination.findMany({
    where: { restaurantId, isActive: true },
    select: {
      id: true,
      areaId: true,
      maxSeats: true,
      minSeats: true,
      priority: true,
      members: { select: { table: { select: { id: true, isActive: true, areaId: true } } } },
    },
  });
  const result: EligibleCombination[] = [];
  for (const c of combos) {
    if (!openAreaIds.has(c.areaId)) continue;
    if (c.maxSeats < partySize) continue;
    if (c.minSeats != null && c.minSeats > partySize) continue;
    const members = c.members.map((m) => m.table);
    if (members.length < 2) continue;
    if (!members.every((t) => t.isActive)) continue;
    if (!members.every((t) => t.areaId === c.areaId)) continue;
    result.push({
      id: c.id,
      areaId: c.areaId,
      areaKind: kindOf.get(c.areaId) ?? null,
      maxSeats: c.maxSeats,
      minSeats: c.minSeats,
      priority: c.priority,
      memberTableIds: members.map((t) => t.id),
    });
  }
  result.sort((a, b) => a.maxSeats - b.maxSeats || a.priority - b.priority);
  return result;
}

function buildDate(dateStr: string, minutes: number, tz: string): Date {
  return businessDateAtMinutes(dateStr, minutes, tz);
}

/** Statusi per-tavolinë në një datë+orë (drejton floor map-in). */
export async function getTableAvailabilityAt(params: {
  restaurantId: string;
  dateStr: string;
  time: string;
  partySize?: number;
  ignoreReservationId?: string;
}): Promise<TableAvailability[]> {
  const { restaurantId, dateStr, time, partySize } = params;
  const settings = await getSettings(restaurantId);
  const tz = settings.timezone;
  const start = buildDate(dateStr, hhmmToMinutes(time), tz);
  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  const bufferMs = settings.seatingBuffer * 60000;

  const tables = await prisma.restaurantTable.findMany({ where: { restaurantId }, orderBy: { sortOrder: "asc" } });

  const dayStart = buildDate(dateStr, 0, tz);
  const dayEnd = buildDate(dateStr, 24 * 60, tz);
  const occupancies = await getOccupanciesInRange(prisma, restaurantId, dayStart, dayEnd, params.ignoreReservationId);

  return tables.map((t) => {
    if (!t.isActive) return { tableId: t.id, status: "inactive" as const };
    if (partySize && t.seats < partySize) return { tableId: t.id, status: "tooSmall" as const };
    const clash = tableClashes(occupancies, t.id, start, end, bufferMs);
    return { tableId: t.id, status: clash ? ("occupied" as const) : ("free" as const) };
  });
}

/** Orët e lira të fillimit për një datë + grup, opsionalisht sipas zonës. */
export async function getAvailableTimes(params: {
  restaurantId: string;
  dateStr: string;
  partySize: number;
  requestedArea?: RequestedArea;
  now?: Date;
}): Promise<TimeSlot[]> {
  const { restaurantId, dateStr, partySize } = params;
  const requestedArea: RequestedArea = params.requestedArea ?? "no_preference";
  const now = params.now ?? new Date();
  const settings = await getSettings(restaurantId);
  const tz = settings.timezone;
  const turn = settings.turnDurationMinutes;
  const interval = settings.bookingInterval;
  const bufferMs = settings.seatingBuffer * 60000;

  const dayStart = buildDate(dateStr, 0, tz);
  const dayOfWeek = businessDayOfWeek(dayStart, tz);
  const dateKey = toBusinessDateKey(dayStart, tz);

  if (await isClosedOn(restaurantId, dateKey, tz)) return [];
  const periods = await getPeriodsForDay(restaurantId, dayOfWeek);
  if (periods.length === 0) return [];

  const areas = await getAreas(restaurantId);
  const openIds = bookableAreaIds(areas, requestedArea);
  const kindOfArea = new Map(areas.map((a) => [a.id, a.kind]));

  const tables = (await prisma.restaurantTable.findMany({ where: { restaurantId, isActive: true } })).filter(
    (t) => t.seats >= partySize && (t.areaId ? openIds.has(t.areaId) : requestedArea === "no_preference")
  );

  const dayEnd = buildDate(dateStr, 24 * 60, tz);
  const reservations = await prisma.reservation.findMany({
    where: { restaurantId, status: { notIn: ["Cancelled", "NoShow"] }, startDateTime: { lte: dayEnd }, endDateTime: { gte: dayStart } },
    select: { tableId: true, startDateTime: true, endDateTime: true, partySize: true, table: { select: { areaId: true } } },
  });

  const caps = await getSlotCaps(restaurantId);
  const areaKindForCap = requestedArea === "no_preference" ? null : requestedArea;
  const closures = await getAreaClosuresInRange(restaurantId, dayStart, dayEnd);
  const occupancies = await getOccupanciesInRange(prisma, restaurantId, dayStart, dayEnd);
  const combos = await getEligibleCombinations(prisma, restaurantId, partySize, openIds);

  const slots: TimeSlot[] = [];
  for (const period of periods) {
    for (let t = period.start; t <= period.lastStart; t += interval) {
      const start = buildDate(dateStr, t, tz);
      const end = new Date(start.getTime() + turn * 60000);
      if (start <= now) continue;
      const timeStr = `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;

      let freeTables = 0;
      for (const table of tables) {
        if (areaClosedAtSlot(closures, table.areaId, start, end)) continue;
        if (!tableClashes(occupancies, table.id, start, end, bufferMs)) freeTables++;
      }
      for (const c of combos) {
        if (areaClosedAtSlot(closures, c.areaId, start, end)) continue;
        if (c.memberTableIds.every((id) => !tableClashes(occupancies, id, start, end, bufferMs))) freeTables++;
      }
      if (freeTables === 0) continue;

      const atSlot = reservations.filter((r) => new Date(r.startDateTime).getTime() === start.getTime());

      const g = capForSlot(caps, dayOfWeek, timeStr, null);
      if (g.maxRes > 0) {
        const remaining = g.maxRes - atSlot.length;
        if (remaining <= 0) continue;
        freeTables = Math.min(freeTables, remaining);
      }
      if (g.maxCovers > 0 && atSlot.reduce((s, r) => s + r.partySize, 0) + partySize > g.maxCovers) continue;

      if (areaKindForCap) {
        const a = capForSlot(caps, dayOfWeek, timeStr, areaKindForCap);
        const inArea = atSlot.filter((r) => {
          const aid = r.table.areaId;
          return aid ? kindOfArea.get(aid) === areaKindForCap : false;
        });
        if (a.maxRes > 0) {
          const remaining = a.maxRes - inArea.length;
          if (remaining <= 0) continue;
          freeTables = Math.min(freeTables, remaining);
        }
        if (a.maxCovers > 0 && inArea.reduce((s, r) => s + r.partySize, 0) + partySize > a.maxCovers) continue;
      }

      slots.push({ time: timeStr, start: start.toISOString(), freeTables });
    }
  }
  return slots;
}

/**
 * Kontroll kapaciteti i sigurt ndaj konkurrencës për kufijtë per-slot, i ekzekutuar
 * BRENDA transaksionit (pas lock-ut këshillues të slot-it) që kërkesat paralele për
 * vendin e fundit të mos e kalojnë kufirin.
 */
export async function slotHasCapacity(
  client: Prisma.TransactionClient,
  params: { restaurantId: string; dateStr: string; time: string; partySize: number; areaKind?: string | null; ignoreReservationId?: string; tz: string }
): Promise<boolean> {
  const caps = await getSlotCaps(params.restaurantId);
  const dow = businessDayOfWeek(buildDate(params.dateStr, 0, params.tz), params.tz);
  const g = capForSlot(caps, dow, params.time, null);
  const a = params.areaKind ? capForSlot(caps, dow, params.time, params.areaKind) : { maxRes: 0, maxCovers: 0 };
  if (g.maxRes <= 0 && g.maxCovers <= 0 && a.maxRes <= 0 && a.maxCovers <= 0) return true;

  const start = buildDate(params.dateStr, hhmmToMinutes(params.time), params.tz);
  const atSlot = await client.reservation.findMany({
    where: {
      restaurantId: params.restaurantId,
      status: { notIn: ["Cancelled", "NoShow"] },
      startDateTime: start,
      ...(params.ignoreReservationId ? { id: { not: params.ignoreReservationId } } : {}),
    },
    select: { partySize: true, table: { select: { area: { select: { kind: true } } } } },
  });

  if (g.maxRes > 0 && atSlot.length >= g.maxRes) return false;
  if (g.maxCovers > 0 && atSlot.reduce((s, r) => s + r.partySize, 0) + params.partySize > g.maxCovers) return false;

  if (params.areaKind && (a.maxRes > 0 || a.maxCovers > 0)) {
    const inArea = atSlot.filter((r) => r.table.area?.kind === params.areaKind);
    if (a.maxRes > 0 && inArea.length >= a.maxRes) return false;
    if (a.maxCovers > 0 && inArea.reduce((s, r) => s + r.partySize, 0) + params.partySize > a.maxCovers) return false;
  }
  return true;
}

export interface AssignmentResult {
  tableIds: string[];
  areaKind: string | null;
}

/**
 * Zgjedh tavolinë(at) për një rezervim BRENDA transaksionit, i sigurt ndaj konkurrencës.
 * Lock: merr një lock këshillues per-tavolinë për çdo kandidat në rend ngjitës id (deterministik
 * → pa deadlock), PARA se të lexojë zënien, që dy rezervime paralele të mos marrin të njëjtën
 * tavolinë. Thirrësi mban lock-un per-slot të parë; kjo shton vetëm lock-e tavoline pas tij.
 */
export async function assignTablesTx(
  tx: Prisma.TransactionClient,
  p: {
    restaurantId: string;
    requestedTableId: string;
    requestedArea: RequestedArea;
    partySize: number;
    start: Date;
    end: Date;
    bufferMs: number;
    ignoreReservationId?: string;
  }
): Promise<AssignmentResult | null> {
  const areas = await tx.area.findMany({ where: { restaurantId: p.restaurantId } });
  const openIds = new Set(
    areas.filter((a) => a.isOpen && (p.requestedArea === "no_preference" || a.kind === p.requestedArea)).map((a) => a.id)
  );
  const kindOf = new Map(areas.map((a) => [a.id, a.kind]));
  const prioOf = new Map(areas.map((a) => [a.id, a.priority]));

  const singleTables = await tx.restaurantTable.findMany({
    where: { restaurantId: p.restaurantId, isActive: true },
    select: { id: true, seats: true, sortOrder: true, areaId: true },
  });
  const combos = await getEligibleCombinations(tx, p.restaurantId, p.partySize, openIds);

  const candidateIds = new Set<string>();
  if (p.requestedTableId !== "any") {
    candidateIds.add(p.requestedTableId);
  } else {
    for (const t of singleTables) {
      if (t.seats < p.partySize) continue;
      if (t.areaId ? openIds.has(t.areaId) : p.requestedArea === "no_preference") candidateIds.add(t.id);
    }
    for (const c of combos) for (const id of c.memberTableIds) candidateIds.add(id);
  }
  // Rend i sortuar deterministik → pa deadlock mes rezervimeve paralele.
  for (const id of Array.from(candidateIds).sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tbl:${id}`})::bigint)`;
  }

  const occ = await getOccupanciesInRange(
    tx,
    p.restaurantId,
    new Date(p.start.getTime() - p.bufferMs),
    new Date(p.end.getTime() + p.bufferMs),
    p.ignoreReservationId
  );
  const closures = await tx.areaClosure.findMany({
    where: { restaurantId: p.restaurantId, startDateTime: { lt: p.end }, endDateTime: { gt: p.start } },
    select: { areaId: true, startDateTime: true, endDateTime: true },
  });
  const isFree = (tableId: string) => !tableClashes(occ, tableId, p.start, p.end, p.bufferMs);

  // Tavolinë konkrete (transferim stafi / pick specifik) → vetëm një tavolinë.
  if (p.requestedTableId !== "any") {
    const t = singleTables.find((x) => x.id === p.requestedTableId);
    if (!t || t.seats < p.partySize) return null;
    if (areaClosedAtSlot(closures, t.areaId, p.start, p.end)) return null;
    if (!isFree(t.id)) return null;
    return { tableIds: [t.id], areaKind: t.areaId ? kindOf.get(t.areaId) ?? null : null };
  }

  // Preferohet një tavolinë e vetme më e vogël e përshtatshme dhe e lirë.
  const eligibleSingles = singleTables
    .filter((t) => t.seats >= p.partySize)
    .filter((t) => (t.areaId ? openIds.has(t.areaId) : p.requestedArea === "no_preference"))
    .filter((t) => !areaClosedAtSlot(closures, t.areaId, p.start, p.end))
    .sort(
      (a, b) =>
        (prioOf.get(a.areaId ?? "") ?? 99) - (prioOf.get(b.areaId ?? "") ?? 99) ||
        a.seats - b.seats ||
        a.sortOrder - b.sortOrder
    );
  const single = eligibleSingles.find((t) => isFree(t.id));
  if (single) {
    return { tableIds: [single.id], areaKind: single.areaId ? kindOf.get(single.areaId) ?? null : null };
  }

  // Asnjë tavolinë e vetme → kombinimi i konfiguruar më i vogël i lirë.
  for (const c of combos) {
    if (areaClosedAtSlot(closures, c.areaId, p.start, p.end)) continue;
    if (c.memberTableIds.every(isFree)) return { tableIds: c.memberTableIds, areaKind: c.areaKind };
  }
  return null;
}

/**
 * Gate server-side: a është `start` orë fillimi legale, pavarësisht tavolinës?
 * Zbaton njoftim minimal (vetëm e ardhmja), mbyllje restoranti, dhe që fillimi bie
 * brenda një periudhe të hapur në/para orës së fundit të lejuar.
 */
export async function isBookableStartTime(params: { restaurantId: string; start: Date; now?: Date }): Promise<boolean> {
  const now = params.now ?? new Date();
  if (params.start <= now) return false;
  const settings = await getSettings(params.restaurantId);
  const tz = settings.timezone;
  const dateStr = toBusinessDateKey(params.start, tz);
  if (await isClosedOn(params.restaurantId, dateStr, tz)) return false;
  const dayOfWeek = businessDayOfWeek(buildDate(dateStr, 0, tz), tz);
  const periods = await getPeriodsForDay(params.restaurantId, dayOfWeek);
  const startMin = businessMinutesOfDay(params.start, tz);
  return periods.some((p) => startMin >= p.start && startMin <= p.lastStart);
}

/** Kontrolli autoritativ para krijimit të një rezervimi. */
export async function isTableBookable(params: {
  restaurantId: string;
  tableId: string;
  start: Date;
  partySize: number;
  now?: Date;
  ignoreReservationId?: string;
  allowPast?: boolean;
}): Promise<boolean> {
  const { restaurantId, tableId, start, partySize } = params;
  const now = params.now ?? new Date();
  const settings = await getSettings(restaurantId);
  const tz = settings.timezone;
  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  const bufferMs = settings.seatingBuffer * 60000;

  if (!params.allowPast && start <= now) return false;

  // Tavolina duhet t'i përkasë KËTIJ restoranti (izolim tenant).
  const table = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId } });
  if (!table || !table.isActive || table.seats < partySize) return false;

  const dateStr = toBusinessDateKey(start, tz);
  const dayStart = buildDate(dateStr, 0, tz);
  const dayOfWeek = businessDayOfWeek(dayStart, tz);

  if (await isClosedOn(restaurantId, dateStr, tz)) return false;

  const periods = await getPeriodsForDay(restaurantId, dayOfWeek);
  const startMin = businessMinutesOfDay(start, tz);
  const insidePeriod = periods.some((p) => startMin >= p.start && startMin <= p.lastStart);
  if (!insidePeriod) return false;

  if (table.areaId) {
    const closures = await getAreaClosuresInRange(restaurantId, start, end);
    if (areaClosedAtSlot(closures, table.areaId, start, end)) return false;
  }

  const clash = await prisma.reservationTable.findFirst({
    where: {
      tableId,
      reservation: {
        restaurantId,
        status: { notIn: ["Cancelled", "NoShow"] },
        id: params.ignoreReservationId ? { not: params.ignoreReservationId } : undefined,
        startDateTime: { lt: new Date(end.getTime() + bufferMs) },
        endDateTime: { gt: new Date(start.getTime() - bufferMs) },
      },
    },
    select: { id: true },
  });
  return !clash;
}

export { businessTimeOfDay, toBusinessDateKey };
