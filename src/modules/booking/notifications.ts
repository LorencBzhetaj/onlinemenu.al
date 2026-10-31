import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * NJOFTIMET (Faza 5). Modeli: krijo NotificationJob NË TË NJËJTIN transaksion me
 * rezervimin (dedupe me dedupeKey unik), dërgo PAS commit-it me një worker që përdor
 * lease + retry. Dështimi i email-it NUK anulon një rezervim të kryer. Dërguesi është
 * i injektueshëm → në test përdoret një sink, pa dërgime reale.
 */

export type NotificationType =
  | "BookingConfirmation"
  | "Cancellation"
  | "Reschedule"
  | "Reminder24h"
  | "Reminder2h"
  | "Completed"
  | "NoShow"
  | "DailyDigest";

export type NotifyMessage = { to: string; subject: string; text: string };
export type NotifyResult = { delivered: boolean; simulated?: boolean; error?: string };
export type NotifySender = (msg: NotifyMessage) => Promise<NotifyResult>;

type Tx = Prisma.TransactionClient;

export interface EnqueueInput {
  restaurantId: string;
  reservationId?: string | null;
  type: NotificationType;
  recipient: string;
  payload: Prisma.InputJsonValue;
  dedupeKey: string;
  scheduledAt?: Date;
}

/**
 * Vendos një job në radhë BRENDA një transaksioni. Idempotent: dedupeKey unik +
 * skipDuplicates → ri-krijimi i të njëjtit event s'dyfishon dërgimin.
 */
export async function enqueueJob(tx: Tx, input: EnqueueInput): Promise<void> {
  await tx.notificationJob.createMany({
    data: [
      {
        restaurantId: input.restaurantId,
        reservationId: input.reservationId ?? null,
        type: input.type,
        recipient: input.recipient,
        payload: input.payload,
        dedupeKey: input.dedupeKey,
        scheduledAt: input.scheduledAt ?? new Date(),
      },
    ],
    skipDuplicates: true,
  });
}

/** Backoff eksponencial i butë (minuta): 1, 2, 4, 8, 16… të kufizuara. */
function backoffMs(attempt: number): number {
  const minutes = Math.min(2 ** Math.max(0, attempt - 1), 30);
  return minutes * 60_000;
}

/** Dërgues default: simulon kur RESEND s'është konfiguruar realisht (pa dërgime reale). */
export const simulateSender: NotifySender = async () => ({ delivered: false, simulated: true });

/**
 * Dërgues real me Resend (i njëjti provider si email.ts). Klienti ndërtohet në mënyrë të
 * dembelt (lazy) që mungesa e çelësit të mos rrëzojë import-in. Përdoret VETËM kur dërgimi
 * live është aktivizuar shprehimisht (shih `defaultNotificationSender`).
 */
export const resendSender: NotifySender = async (msg) => {
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.EMAIL_FROM || "MenuDigjitale <onboarding@resend.dev>";
    const { data, error } = await resend.emails.send({ from, to: msg.to, subject: msg.subject, text: msg.text });
    if (error) return { delivered: false, error: typeof error === "string" ? error : JSON.stringify(error) };
    return { delivered: true, simulated: false, ...(data?.id ? {} : {}) };
  } catch (e) {
    return { delivered: false, error: e instanceof Error ? e.message : "resend_threw" };
  }
};

/**
 * Përzgjedh dërguesin sipas mjedisit. SIGURI (Faza 8): dërgimi LIVE është OPT-IN eksplicit —
 * vetëm prod vendos `EMAIL_SEND_LIVE=1` me një `RESEND_API_KEY` real. Kudo tjetër (staging,
 * Preview, CI, lokal) → `simulateSender` si "email sink": job-et përpunohen dhe shënohen
 * Simulated, PA dërguar email real. Kështu staging-u s'i dërgon kurrë email mysafirëve realë.
 */
export function defaultNotificationSender(): NotifySender {
  const live = process.env.EMAIL_SEND_LIVE === "1";
  const key = process.env.RESEND_API_KEY;
  if (live && key && key !== "re_dummy") return resendSender;
  return simulateSender;
}

export interface WorkerResult {
  claimed: number;
  sent: number;
  simulated: number;
  failed: number;
  dead: number;
}

/**
 * Përpunon job-et e gatshme (scheduledAt<=now, pa lease aktiv), një nga një, me
 * claim atomik (updateMany i mbrojtur me status+lease) → i sigurt ndaj disa worker-ëve.
 * Në sukses: Sent/Simulated. Në dështim: retry me backoff derisa maxAttempts → Dead.
 */
export async function runNotificationWorker(opts: {
  restaurantId?: string;
  now?: Date;
  send?: NotifySender;
  limit?: number;
  leaseMs?: number;
} = {}): Promise<WorkerResult> {
  const now = opts.now ?? new Date();
  const send = opts.send ?? simulateSender;
  const limit = opts.limit ?? 50;
  const leaseMs = opts.leaseMs ?? 60_000;
  const res: WorkerResult = { claimed: 0, sent: 0, simulated: 0, failed: 0, dead: 0 };

  const candidates = await prisma.notificationJob.findMany({
    where: {
      ...(opts.restaurantId ? { restaurantId: opts.restaurantId } : {}),
      status: { in: ["Pending", "Failed"] },
      scheduledAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const { id } of candidates) {
    // Claim atomik: vetëm një worker e kalon në "Sending" + merr lease + increment attempts.
    const claim = await prisma.notificationJob.updateMany({
      where: {
        id,
        status: { in: ["Pending", "Failed"] },
        scheduledAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      data: { status: "Sending", leaseUntil: new Date(now.getTime() + leaseMs), attempts: { increment: 1 } },
    });
    if (claim.count !== 1) continue; // e mori një worker tjetër

    res.claimed++;
    const job = await prisma.notificationJob.findUnique({ where: { id } });
    if (!job) continue;

    let outcome: NotifyResult;
    try {
      outcome = await send({ to: job.recipient, subject: subjectFor(job.type, job.payload), text: bodyFor(job.type, job.payload) });
    } catch (e) {
      outcome = { delivered: false, error: e instanceof Error ? e.message : "send_threw" };
    }

    const deliveryOutcome = outcome.delivered ? "sent" : outcome.simulated ? "simulated" : "failed";
    await prisma.notificationDelivery.create({ data: { jobId: id, attempt: job.attempts, outcome: deliveryOutcome, detail: outcome.error ?? null } });

    if (outcome.delivered || outcome.simulated) {
      await prisma.notificationJob.update({ where: { id }, data: { status: outcome.delivered ? "Sent" : "Simulated", leaseUntil: null, lastError: null } });
      if (outcome.delivered) res.sent++; else res.simulated++;
    } else if (job.attempts >= job.maxAttempts) {
      await prisma.notificationJob.update({ where: { id }, data: { status: "Dead", leaseUntil: null, lastError: outcome.error ?? "failed" } });
      res.dead++;
    } else {
      await prisma.notificationJob.update({
        where: { id },
        data: { status: "Failed", leaseUntil: null, lastError: outcome.error ?? "failed", scheduledAt: new Date(now.getTime() + backoffMs(job.attempts)) },
      });
      res.failed++;
    }
  }

  return res;
}

/**
 * Raporti ditor (digest) për një restorant + datë-lokale. Idempotent: DailyReport unik
 * (restaurantId, reportDate, type) → një email/datë. Enqueue-on një DailyDigest job te
 * pronari. Thirret nga cron-i; dërgimi bëhet nga worker-i.
 */
export async function generateDailyDigest(
  restaurantId: string,
  reportDate: string,
  dayStart: Date,
  dayEnd: Date
): Promise<{ created: boolean }> {
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true, owner: { select: { email: true } } } });
  const ownerEmail = r?.owner?.email;
  if (!ownerEmail) return { created: false };

  const list = await prisma.reservation.findMany({
    where: { restaurantId, status: { notIn: ["Cancelled", "NoShow"] }, startDateTime: { gte: dayStart, lt: dayEnd } },
    select: { partySize: true },
  });
  const guests = list.reduce((s, x) => s + x.partySize, 0);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dailyReport.create({ data: { restaurantId, reportDate, type: "DailyDigest", reservations: list.length, guests, status: "Pending" } });
      await enqueueJob(tx, {
        restaurantId,
        type: "DailyDigest",
        recipient: ownerEmail,
        payload: { restaurantName: r!.name, date: reportDate, reservations: list.length, guests },
        dedupeKey: `digest:${restaurantId}:${reportDate}`,
      });
    });
    return { created: true };
  } catch (e) {
    // Dublikatë (DailyReport unik ose dedupeKey) → tashmë i gjeneruar, idempotent.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { created: false };
    throw e;
  }
}

// ── Shabllone (tekst i thjeshtë; payload = Json i ruajtur me job-in) ──
type Payload = Record<string, unknown>;
function p(payload: Prisma.JsonValue): Payload {
  return (payload && typeof payload === "object" ? payload : {}) as Payload;
}

export function subjectFor(type: string, payload: Prisma.JsonValue): string {
  const d = p(payload);
  const name = String(d.restaurantName ?? "Restoranti");
  switch (type) {
    case "BookingConfirmation": return `Rezervimi u konfirmua — ${name}`;
    case "Cancellation": return `Rezervimi u anulua — ${name}`;
    case "Reschedule": return `Rezervimi u riplanifikua — ${name}`;
    case "Reminder24h": return `Kujtesë: rezervimi nesër — ${name}`;
    case "Reminder2h": return `Kujtesë: rezervimi së shpejti — ${name}`;
    case "DailyDigest": return `Rezervimet e sotme — ${name}`;
    default: return `${name}`;
  }
}

export function bodyFor(type: string, payload: Prisma.JsonValue): string {
  const d = p(payload);
  const name = String(d.restaurantName ?? "Restoranti");
  if (type === "DailyDigest") {
    return `${name}: ${d.reservations ?? 0} rezervime, ${d.guests ?? 0} mysafirë për ${d.date ?? ""}.`;
  }
  const when = String(d.when ?? "");
  const party = d.partySize ?? "";
  const guest = String(d.guestName ?? "");
  const manage = d.manageUrl ? `\nMenaxho: ${d.manageUrl}` : "";
  const head =
    type === "Cancellation" ? "Rezervimi juaj u anulua." :
    type === "Reschedule" ? "Rezervimi juaj u riplanifikua." :
    type.startsWith("Reminder") ? "Kujtesë për rezervimin tuaj." :
    "Rezervimi juaj u konfirmua.";
  return `${head}\n${name}\n${guest ? guest + " · " : ""}${party} persona · ${when}${manage}`;
}
