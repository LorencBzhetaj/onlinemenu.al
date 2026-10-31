import { prisma } from "@/lib/prisma";
import type { ActionResult } from "./reservations";

/**
 * Shërbime konfigurimi të booking-ut (Faza 4): zona, tavolina, kombinime, orare,
 * mbyllje dhe kufij slot-i — të gjitha tenant-scoped me validim pronësie. Pa UI
 * (paneli i plotë → Faza 5); këto shërbime drejtojnë motorin, seed-in dhe testet.
 */

// ── BookingSettings ──
export async function ensureBookingSettings(restaurantId: string) {
  return prisma.bookingSettings.upsert({
    where: { restaurantId },
    create: { restaurantId },
    update: {},
  });
}

export type BookingSettingsPatch = Partial<{
  turnDurationMinutes: number;
  bookingInterval: number;
  seatingBuffer: number;
  maxPartySize: number;
  maxReservationsPerSlot: number;
  maxCoversPerSlot: number;
  timezone: string;
}>;

export async function updateBookingSettings(restaurantId: string, patch: BookingSettingsPatch) {
  return prisma.bookingSettings.upsert({
    where: { restaurantId },
    create: { restaurantId, ...patch },
    update: patch,
  });
}

// ── Areas ──
export async function createArea(
  restaurantId: string,
  data: { name: string; kind?: string; isOpen?: boolean; weatherDependent?: boolean; priority?: number }
) {
  const count = await prisma.area.count({ where: { restaurantId } });
  return prisma.area.create({
    data: {
      restaurantId,
      name: data.name,
      kind: data.kind === "outdoor" ? "outdoor" : "indoor",
      isOpen: data.isOpen ?? true,
      weatherDependent: data.weatherDependent ?? false,
      priority: data.priority ?? 0,
      sortOrder: count + 1,
    },
  });
}

export async function setAreaOpen(restaurantId: string, areaId: string, isOpen: boolean): Promise<ActionResult> {
  const a = await prisma.area.findFirst({ where: { id: areaId, restaurantId }, select: { id: true } });
  if (!a) return { ok: false, error: "Zona nuk u gjet." };
  await prisma.area.update({ where: { id: areaId }, data: { isOpen } });
  return { ok: true };
}

export async function updateArea(
  restaurantId: string,
  areaId: string,
  patch: Partial<{ name: string; kind: string; isOpen: boolean; weatherDependent: boolean; priority: number }>
): Promise<ActionResult> {
  const a = await prisma.area.findFirst({ where: { id: areaId, restaurantId }, select: { id: true } });
  if (!a) return { ok: false, error: "Zona nuk u gjet." };
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.kind !== undefined) data.kind = patch.kind === "outdoor" ? "outdoor" : "indoor";
  if (patch.isOpen !== undefined) data.isOpen = patch.isOpen;
  if (patch.weatherDependent !== undefined) data.weatherDependent = patch.weatherDependent;
  if (patch.priority !== undefined) data.priority = patch.priority;
  await prisma.area.update({ where: { id: areaId }, data });
  return { ok: true };
}

export async function deleteArea(restaurantId: string, areaId: string): Promise<ActionResult> {
  const a = await prisma.area.findFirst({ where: { id: areaId, restaurantId }, select: { id: true } });
  if (!a) return { ok: false, error: "Zona nuk u gjet." };
  const tables = await prisma.restaurantTable.count({ where: { areaId } });
  if (tables > 0) return { ok: false, error: "Zona ka tavolina — zhvendosi ose fshi ato më parë." };
  await prisma.area.delete({ where: { id: areaId } });
  return { ok: true };
}

// ── Tables ──
export async function createTable(
  restaurantId: string,
  data: { name: string; seats: number; section?: string; areaId?: string | null; shape?: string; isActive?: boolean }
): Promise<ActionResult<{ id: string }>> {
  // areaId (kur jepet) duhet t'i përkasë KËTIJ restoranti (izolim tenant).
  if (data.areaId) {
    const area = await prisma.area.findFirst({ where: { id: data.areaId, restaurantId }, select: { id: true } });
    if (!area) return { ok: false, error: "Zona nuk i përket këtij restoranti." };
  }
  const seats = Math.trunc(Number(data.seats));
  if (!Number.isFinite(seats) || seats <= 0) return { ok: false, error: "Vendet duhet > 0." };
  const count = await prisma.restaurantTable.count({ where: { restaurantId } });
  const t = await prisma.restaurantTable.create({
    data: {
      restaurantId,
      name: data.name,
      seats,
      section: data.section ?? "",
      areaId: data.areaId ?? null,
      shape: data.shape ?? "square",
      isActive: data.isActive ?? true,
      sortOrder: count + 1,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: t.id } };
}

export async function updateTable(
  restaurantId: string,
  tableId: string,
  patch: Partial<{ name: string; seats: number; section: string; areaId: string | null; shape: string; isActive: boolean; x: number; y: number; w: number; h: number; rotation: number }>
): Promise<ActionResult> {
  const t = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId }, select: { id: true } });
  if (!t) return { ok: false, error: "Tavolina nuk u gjet." };
  if (patch.areaId) {
    const area = await prisma.area.findFirst({ where: { id: patch.areaId, restaurantId }, select: { id: true } });
    if (!area) return { ok: false, error: "Zona nuk i përket këtij restoranti." };
  }
  const data: Record<string, unknown> = {};
  for (const k of ["name", "seats", "section", "areaId", "shape", "isActive", "x", "y", "w", "h", "rotation"] as const) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  if (data.seats !== undefined) {
    const s = Math.trunc(Number(data.seats));
    if (!Number.isFinite(s) || s <= 0) return { ok: false, error: "Vendet duhet > 0." };
    data.seats = s;
  }
  await prisma.restaurantTable.update({ where: { id: tableId }, data });
  return { ok: true };
}

/** Çaktivizim/aktivizim i një tavoline — mënyra e duhur për tavolina me histori. */
export async function setTableActive(restaurantId: string, tableId: string, isActive: boolean): Promise<ActionResult> {
  const t = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId }, select: { id: true } });
  if (!t) return { ok: false, error: "Tavolina nuk u gjet." };
  await prisma.restaurantTable.update({ where: { id: tableId }, data: { isActive } });
  return { ok: true };
}

/** A ka tavolina histori rezervimesh (si primare OSE anëtare kombinimi)? */
async function tableHasHistory(tableId: string): Promise<boolean> {
  const [asPrimary, asMember] = await Promise.all([
    prisma.reservation.count({ where: { tableId } }),
    prisma.reservationTable.count({ where: { tableId } }),
  ]);
  return asPrimary > 0 || asMember > 0;
}

/**
 * Fshirje e një tavoline — VETËM kur s'ka histori rezervimesh. Me histori → refuzohet
 * dhe sugjerohet çaktivizimi (ruajtja e historikut). Nuk e dobëson FK-në.
 */
export async function deleteTable(restaurantId: string, tableId: string): Promise<ActionResult> {
  const t = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId }, select: { id: true } });
  if (!t) return { ok: false, error: "Tavolina nuk u gjet." };
  if (await tableHasHistory(tableId)) {
    return { ok: false, error: "Tavolina ka histori rezervimesh — çaktivizoje në vend që ta fshish." };
  }
  await prisma.restaurantTable.delete({ where: { id: tableId } });
  return { ok: true };
}

/**
 * Politikë eksplicite për klientët: fshirja lejohet VETËM pa rezervime. Me rezervime
 * → refuzohet (historiku ruhet; stafi mund të anonimizojë fushat në vend të fshirjes).
 */
export async function deleteCustomer(restaurantId: string, customerId: string): Promise<ActionResult> {
  const c = await prisma.customer.findFirst({ where: { id: customerId, restaurantId }, select: { id: true } });
  if (!c) return { ok: false, error: "Klienti nuk u gjet." };
  const count = await prisma.reservation.count({ where: { customerId } });
  if (count > 0) return { ok: false, error: "Klienti ka rezervime — historiku ruhet; fshirja nuk lejohet." };
  await prisma.customer.delete({ where: { id: customerId } });
  return { ok: true };
}

/**
 * RRJEDHË E POSAÇME: fshirja e të dhënave booking të një tenant-i, në rendin e duhur
 * (rezervimet të parat → tavolinat/klientët pastaj), brenda një transaksioni. Përdoret
 * vetëm kur fshihet qëllimisht një restorant/tenant, JO si cascade aksidental.
 */
export async function purgeRestaurantBookingData(restaurantId: string): Promise<void> {
  await prisma.$transaction([
    prisma.notificationJob.deleteMany({ where: { restaurantId } }), // cascade → deliveries
    prisma.reservation.deleteMany({ where: { restaurantId } }), // cascade → reservationTable
    prisma.tableCombination.deleteMany({ where: { restaurantId } }),
    prisma.restaurantTable.deleteMany({ where: { restaurantId } }),
    prisma.customer.deleteMany({ where: { restaurantId } }),
    prisma.areaClosure.deleteMany({ where: { restaurantId } }),
    prisma.area.deleteMany({ where: { restaurantId } }),
    prisma.closure.deleteMany({ where: { restaurantId } }),
    prisma.openingHour.deleteMany({ where: { restaurantId } }),
    prisma.slotLimit.deleteMany({ where: { restaurantId } }),
    prisma.dailyReport.deleteMany({ where: { restaurantId } }),
  ]);
}

// ── Combinations ──
export async function createCombination(
  restaurantId: string,
  data: { name: string; areaId: string; maxSeats: number; minSeats?: number | null; priority?: number; memberTableIds: string[] }
): Promise<ActionResult<{ id: string }>> {
  const area = await prisma.area.findFirst({ where: { id: data.areaId, restaurantId }, select: { id: true } });
  if (!area) return { ok: false, error: "Zona nuk i përket këtij restoranti." };
  if (data.memberTableIds.length < 2) return { ok: false, error: "Kombinimi kërkon të paktën dy tavolina." };

  // Çdo anëtar duhet të jetë tavolinë e këtij restoranti NË zonën e kombinimit.
  const members = await prisma.restaurantTable.findMany({
    where: { id: { in: data.memberTableIds }, restaurantId },
    select: { id: true, areaId: true },
  });
  if (members.length !== data.memberTableIds.length) return { ok: false, error: "Një tavolinë s'i përket këtij restoranti." };
  if (!members.every((m) => m.areaId === data.areaId)) return { ok: false, error: "Të gjitha tavolinat duhet të jenë në zonën e kombinimit." };

  const combo = await prisma.tableCombination.create({
    data: {
      restaurantId,
      name: data.name,
      areaId: data.areaId,
      maxSeats: data.maxSeats,
      minSeats: data.minSeats ?? null,
      priority: data.priority ?? 0,
      members: { create: data.memberTableIds.map((tableId) => ({ tableId })) },
    },
    select: { id: true },
  });
  return { ok: true, data: { id: combo.id } };
}

export async function deleteCombination(restaurantId: string, combinationId: string): Promise<ActionResult> {
  const c = await prisma.tableCombination.findFirst({ where: { id: combinationId, restaurantId }, select: { id: true } });
  if (!c) return { ok: false, error: "Kombinimi nuk u gjet." };
  await prisma.tableCombination.delete({ where: { id: combinationId } });
  return { ok: true };
}

// ── Opening hours (replace-all për ditë ose të gjitha) ──
export type OpeningHourInput = { dayOfWeek: number; startTime: string; endTime: string; lastBookingTime?: string | null; isActive?: boolean };

/** Zëvendëson plotësisht orarin e restorantit me listën e dhënë. */
export async function setOpeningHours(restaurantId: string, hours: OpeningHourInput[]): Promise<ActionResult> {
  for (const h of hours) {
    if (h.dayOfWeek < 0 || h.dayOfWeek > 6) return { ok: false, error: "dayOfWeek i pavlefshëm." };
    if (!/^\d{2}:\d{2}$/.test(h.startTime) || !/^\d{2}:\d{2}$/.test(h.endTime)) return { ok: false, error: "Orët duhet HH:mm." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.openingHour.deleteMany({ where: { restaurantId } });
    if (hours.length > 0) {
      await tx.openingHour.createMany({
        data: hours.map((h) => ({
          restaurantId,
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
          lastBookingTime: h.lastBookingTime ?? null,
          isActive: h.isActive ?? true,
        })),
      });
    }
  });
  return { ok: true };
}

// ── Closures ──
export async function createClosure(restaurantId: string, data: { startDate: Date; endDate: Date; reason?: string }) {
  return prisma.closure.create({
    data: { restaurantId, startDate: data.startDate, endDate: data.endDate, reason: data.reason ?? null },
  });
}

export async function createAreaClosure(
  restaurantId: string,
  data: { areaId: string; startDateTime: Date; endDateTime: Date; reason?: string }
): Promise<ActionResult<{ id: string }>> {
  const area = await prisma.area.findFirst({ where: { id: data.areaId, restaurantId }, select: { id: true } });
  if (!area) return { ok: false, error: "Zona nuk i përket këtij restoranti." };
  const c = await prisma.areaClosure.create({
    data: { restaurantId, areaId: data.areaId, startDateTime: data.startDateTime, endDateTime: data.endDateTime, reason: data.reason ?? null },
    select: { id: true },
  });
  return { ok: true, data: { id: c.id } };
}

export async function deleteClosure(restaurantId: string, closureId: string): Promise<ActionResult> {
  const c = await prisma.closure.findFirst({ where: { id: closureId, restaurantId }, select: { id: true } });
  if (!c) return { ok: false, error: "Mbyllja nuk u gjet." };
  await prisma.closure.delete({ where: { id: closureId } });
  return { ok: true };
}

export async function deleteAreaClosure(restaurantId: string, id: string): Promise<ActionResult> {
  const c = await prisma.areaClosure.findFirst({ where: { id, restaurantId }, select: { id: true } });
  if (!c) return { ok: false, error: "Mbyllja nuk u gjet." };
  await prisma.areaClosure.delete({ where: { id } });
  return { ok: true };
}

// ── Slot limits ──
export async function deleteSlotLimit(restaurantId: string, id: string): Promise<ActionResult> {
  const l = await prisma.slotLimit.findFirst({ where: { id, restaurantId }, select: { id: true } });
  if (!l) return { ok: false, error: "Kufiri nuk u gjet." };
  await prisma.slotLimit.delete({ where: { id } });
  return { ok: true };
}

export async function createSlotLimit(
  restaurantId: string,
  data: { time: string; maxReservations: number; maxCovers?: number | null; dayOfWeek?: number | null; areaKind?: string | null }
): Promise<ActionResult<{ id: string }>> {
  if (!/^\d{2}:\d{2}$/.test(data.time)) return { ok: false, error: "Ora duhet HH:mm." };
  const l = await prisma.slotLimit.create({
    data: {
      restaurantId,
      time: data.time,
      maxReservations: data.maxReservations,
      maxCovers: data.maxCovers ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      areaKind: data.areaKind ?? null,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: l.id } };
}
