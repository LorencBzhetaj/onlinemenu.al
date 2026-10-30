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

// ── Slot limits ──
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
