import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import {
  getSettings,
  isBookableStartTime,
  isTableBookable,
  slotHasCapacity,
  assignTablesTx,
  businessTimeOfDay,
  toBusinessDateKey,
  type RequestedArea,
} from "./availability";

/**
 * SHËRBIMET E REZERVIMIT (Faza 4) — krijim/anulim/riplanifikim atomik, idempotent dhe
 * i sigurt ndaj konkurrencës, i izoluar me restaurantId. NUK dërgon njoftime: email/SMS,
 * formulari publik dhe paneli i plotë lidhen në Fazën 5. BOOKING kontrollohet me entitlement.
 */

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const REQUESTED_AREAS: RequestedArea[] = ["indoor", "outdoor", "no_preference"];
const STATUSES = ["Confirmed", "Seated", "Completed", "Cancelled", "NoShow"] as const;
export type ReservationStatus = (typeof STATUSES)[number];

export interface ReservationInput {
  restaurantId: string;
  start: string; // ISO
  partySize: number;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  whatsappNumber?: string;
  notes?: string;
  tableId?: string; // "any" (default) ose një id konkret
  requestedArea?: RequestedArea;
  idempotencyKey?: string;
}

function validate(input: ReservationInput, maxPartySize: number): { ok: true } | { ok: false; error: string } {
  if (!input.restaurantId) return { ok: false, error: "restaurantId mungon." };
  if (!input.firstName?.trim()) return { ok: false, error: "Emri është i detyrueshëm." };
  if (!input.phone?.trim()) return { ok: false, error: "Telefoni është i detyrueshëm." };
  const party = Math.trunc(Number(input.partySize));
  if (!Number.isFinite(party) || party <= 0) return { ok: false, error: "Numri i personave duhet > 0." };
  if (party > maxPartySize) return { ok: false, error: `Grupi maksimal është ${maxPartySize} persona.` };
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Ora e zgjedhur është e pavlefshme." };
  if (input.requestedArea && !REQUESTED_AREAS.includes(input.requestedArea)) return { ok: false, error: "Zonë e pavlefshme." };
  return { ok: true };
}

/** Klient i gjetur/krijuar BRENDA tenant-it (unik restaurantId+phone). */
async function findOrCreateCustomer(
  client: Prisma.TransactionClient | typeof prisma,
  restaurantId: string,
  input: ReservationInput
) {
  const phone = input.phone.trim();
  const existing = await client.customer.findUnique({ where: { restaurantId_phone: { restaurantId, phone } } });
  if (existing) return existing;
  try {
    return await client.customer.create({
      data: {
        restaurantId,
        firstName: input.firstName.trim(),
        lastName: (input.lastName || "").trim(),
        phone,
        whatsappNumber: input.whatsappNumber || phone,
        email: input.email || null,
        notes: input.notes || null,
      },
    });
  } catch (e) {
    // Garë mes dy rezervimeve të njëkohshme me të njëjtin telefon: fituesi krijoi
    // klientin; ne rilexojmë atë në vend që të dështojmë (unik restaurantId+phone).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await client.customer.findUnique({ where: { restaurantId_phone: { restaurantId, phone } } });
      if (again) return again;
    }
    throw e;
  }
}

async function writeReservationTables(tx: Prisma.TransactionClient, reservationId: string, tableIds: string[]) {
  await tx.reservationTable.createMany({
    data: tableIds.map((tableId) => ({ reservationId, tableId })),
    skipDuplicates: true,
  });
}

/** Çelës lock-u per-slot, i prefiksuar me restaurantId → izolim mes restoranteve. */
function slotLockKey(restaurantId: string, dateStr: string, time: string): string {
  return `${restaurantId}:${dateStr}T${time}`;
}

/**
 * Rezervim publik: validim → gate orari → (pre-check tavoline) → transaksion atomik
 * me lock per-slot + assignment i sigurt + kontroll kapaciteti. Idempotent per tenant.
 */
export async function createReservation(
  raw: ReservationInput,
  opts: { requireEntitlement?: boolean } = {}
): Promise<ActionResult<{ reservationId: string; cancelToken: string }>> {
  const requireEntitlement = opts.requireEntitlement ?? true;
  const settings = await getSettings(raw.restaurantId);

  const v = validate(raw, settings.maxPartySize);
  if (!v.ok) return v;

  // Entitlement BOOKING (përfshin suspendedAt + status abonimi + statusin e modulit).
  if (requireEntitlement && !(await hasEntitlement(raw.restaurantId, "BOOKING"))) {
    return { ok: false, error: "Rezervimet nuk janë aktive për këtë restorant." };
  }

  const restaurantId = raw.restaurantId;
  const tableId = raw.tableId || "any";
  const requestedArea: RequestedArea = raw.requestedArea ?? "no_preference";
  const idem = raw.idempotencyKey;
  const start = new Date(raw.start);
  const tz = settings.timezone;

  // Replay idempotent: ritentativë me të njëjtin çelës kthen rezervimin ekzistues.
  if (idem) {
    const existing = await prisma.reservation.findUnique({
      where: { restaurantId_idempotencyKey: { restaurantId, idempotencyKey: idem } },
    });
    if (existing) return { ok: true, data: { reservationId: existing.id, cancelToken: existing.cancelToken } };
  }

  // Gate i orarit për ÇDO rezervim (përfshirë "any" dhe thirrje direkte).
  if (!(await isBookableStartTime({ restaurantId, start }))) {
    return { ok: false, error: "Ajo orë është jashtë orarit tonë. Zgjidhni një orë të disponueshme." };
  }

  const isAny = tableId === "any";
  if (!isAny) {
    const bookable = await isTableBookable({ restaurantId, tableId, start, partySize: raw.partySize });
    if (!bookable) return { ok: false, error: "Ajo tavolinë nuk është më e disponueshme. Zgjidhni një orë tjetër." };
  }

  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  const bufferMs = settings.seatingBuffer * 60000;
  const dateStr = toBusinessDateKey(start, tz);
  const time = businessTimeOfDay(start, tz);

  try {
    const customer = await findOrCreateCustomer(prisma, restaurantId, raw);
    const reservation = await prisma.$transaction(
      async (tx) => {
        // Serializon rezervimet paralele për TË NJËJTIN slot (caps + assignment të sigurt).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${slotLockKey(restaurantId, dateStr, time)})::bigint)`;

        const assigned = await assignTablesTx(tx, {
          restaurantId,
          requestedTableId: tableId,
          requestedArea,
          partySize: raw.partySize,
          start,
          end,
          bufferMs,
        });
        if (!assigned) throw new Error(isAny ? "NO_TABLE" : "SLOT_TAKEN");

        if (!(await slotHasCapacity(tx, { restaurantId, dateStr, time, partySize: raw.partySize, areaKind: assigned.areaKind, tz }))) {
          throw new Error("SLOT_FULL");
        }

        const created = await tx.reservation.create({
          data: {
            restaurantId,
            tableId: assigned.tableIds[0],
            customerId: customer.id,
            startDateTime: start,
            endDateTime: end,
            partySize: raw.partySize,
            status: "Confirmed",
            notes: raw.notes || null,
            source: "Online",
            requestedArea,
            idempotencyKey: idem ?? undefined,
          },
        });
        await writeReservationTables(tx, created.id, assigned.tableIds);
        return created;
      },
      { timeout: 20000, maxWait: 12000 }
    );
    return { ok: true, data: { reservationId: reservation.id, cancelToken: reservation.cancelToken } };
  } catch (e) {
    // Dublikatë i njëkohshëm i të njëjtit çelës idempotency → kthe rezervimin fitues.
    if (idem && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.reservation.findUnique({
        where: { restaurantId_idempotencyKey: { restaurantId, idempotencyKey: idem } },
      });
      if (existing) return { ok: true, data: { reservationId: existing.id, cancelToken: existing.cancelToken } };
    }
    if (e instanceof Error && (e.message === "SLOT_FULL" || e.message === "NO_TABLE")) {
      return { ok: false, error: "Ajo orë është plot. Zgjidhni një orë tjetër." };
    }
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return { ok: false, error: "Ajo tavolinë sapo u zu. Zgjidhni një orë tjetër." };
    }
    throw e;
  }
}

/** Walk-in nga stafi: anashkalon kufijtë per-slot por merr tavolinë reale pa konflikt. */
export async function createWalkIn(raw: ReservationInput): Promise<ActionResult<{ reservationId: string }>> {
  const settings = await getSettings(raw.restaurantId);
  const v = validate(raw, settings.maxPartySize);
  if (!v.ok) return v;
  if (!(await hasEntitlement(raw.restaurantId, "BOOKING"))) {
    return { ok: false, error: "Rezervimet nuk janë aktive për këtë restorant." };
  }

  const restaurantId = raw.restaurantId;
  const tableId = raw.tableId || "any";
  const requestedArea: RequestedArea = raw.requestedArea ?? "no_preference";
  const start = new Date(raw.start);
  const tz = settings.timezone;
  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  const bufferMs = settings.seatingBuffer * 60000;
  const dateStr = toBusinessDateKey(start, tz);
  const time = businessTimeOfDay(start, tz);

  try {
    const customer = await findOrCreateCustomer(prisma, restaurantId, raw);
    const reservation = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${slotLockKey(restaurantId, dateStr, time)})::bigint)`;
        const assigned = await assignTablesTx(tx, {
          restaurantId,
          requestedTableId: tableId,
          requestedArea,
          partySize: raw.partySize,
          start,
          end,
          bufferMs,
        });
        if (!assigned) throw new Error("SLOT_TAKEN");
        const created = await tx.reservation.create({
          data: {
            restaurantId,
            tableId: assigned.tableIds[0],
            customerId: customer.id,
            startDateTime: start,
            endDateTime: end,
            partySize: raw.partySize,
            status: "Confirmed",
            notes: raw.notes || null,
            source: "Walk-in",
            requestedArea,
          },
        });
        await writeReservationTables(tx, created.id, assigned.tableIds);
        return created;
      },
      { timeout: 20000, maxWait: 12000 }
    );
    return { ok: true, data: { reservationId: reservation.id } };
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") return { ok: false, error: "Ajo tavolinë sapo u zu." };
    throw e;
  }
}

/** Anulim vetë-shërbimi me token (token unik global; nuk kërkon tenant). Idempotent. */
export async function cancelReservationByToken(token: string): Promise<ActionResult> {
  const res = await prisma.reservation.findUnique({ where: { cancelToken: token } });
  if (!res) return { ok: false, error: "Rezervimi nuk u gjet." };
  if (res.status === "Cancelled") return { ok: true };
  if (res.status === "Completed") return { ok: false, error: "Ky rezervim ka ndodhur tashmë." };
  await prisma.reservation.update({ where: { id: res.id }, data: { status: "Cancelled" } });
  return { ok: true };
}

/**
 * Riplanifikim atomik: liron tavolinë(at) e vjetra dhe rezervon të renë në një
 * transaksion të vetëm (asnjë dritare ku rezervimi mban të dyja ose asnjë).
 */
export async function rescheduleReservation(
  restaurantId: string,
  id: string,
  newStartIso: string,
  newTableId?: string
): Promise<ActionResult> {
  const res = await prisma.reservation.findFirst({ where: { id, restaurantId } });
  if (!res) return { ok: false, error: "Rezervimi nuk u gjet." };
  const tableId = newTableId || res.tableId;
  const start = new Date(newStartIso);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Orë e pavlefshme." };

  const settings = await getSettings(restaurantId);
  const bookable = await isTableBookable({ restaurantId, tableId, start, partySize: res.partySize, ignoreReservationId: id });
  if (!bookable) return { ok: false, error: "Ajo tavolinë/orë nuk është e disponueshme." };

  const end = new Date(start.getTime() + settings.turnDurationMinutes * 60000);
  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id }, data: { startDateTime: start, endDateTime: end, tableId } });
    await tx.reservationTable.deleteMany({ where: { reservationId: id } });
    await tx.reservationTable.create({ data: { reservationId: id, tableId } });
  });
  return { ok: true };
}

/** Ndryshim statusi (staf). Tenant-scoped. */
export async function setReservationStatus(restaurantId: string, id: string, status: ReservationStatus): Promise<ActionResult> {
  if (!STATUSES.includes(status)) return { ok: false, error: "Status i pavlefshëm." };
  const res = await prisma.reservation.findFirst({ where: { id, restaurantId }, select: { id: true } });
  if (!res) return { ok: false, error: "Rezervimi nuk u gjet." };
  await prisma.reservation.update({ where: { id }, data: { status } });
  return { ok: true };
}
