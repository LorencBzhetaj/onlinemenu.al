// Njoftimet e rezervimeve PËR BIZNESIN (rezervim i ri, ndryshim orari, anulim nga klienti).
//
// - Ripërdor radhën ekzistuese (NotificationJob) brenda të njëjtit transaksion me rezervimin.
// - Një job për çdo marrës × kanal: status, riprovim dhe dedupe të veçanta → dështimi i një kanali
//   s'prek rezervimin as kanalin tjetër.
// - Marrës: NotificationRecipient i verifikuar + i aktivizuar + kanali i ndezur te BookingSettings;
//   WhatsApp kërkon edhe pëlqimin e marrësit. Pa marrës email të konfiguruar → email-i i pronarit
//   (i verifikuar te llogaria), si më parë.
// - Mesazhi: datë, orë, persona, referencë dhe lidhje te paneli (me login). KURRË token-i i
//   anulimit të klientit, telefoni apo email-i i klientit.
import type { Prisma } from "@prisma/client";
import { enqueueJob, type NotificationType } from "./notifications";

type Tx = Prisma.TransactionClient;
export type BusinessEvent = "new" | "reschedule" | "cancel";

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const TYPE: Record<BusinessEvent, NotificationType> = {
  new: "BusinessNewBooking",
  reschedule: "BusinessReschedule",
  cancel: "BusinessCancellation",
};

/** Referencë e shkurtër, e qëndrueshme dhe jo-sekrete (s'lejon menaxhim pa login). */
export function bookingReference(reservationId: string): string {
  return `OM-${reservationId.slice(-6).toUpperCase()}`;
}

export function panelReservationsUrl(restaurantId: string): string {
  return `${BASE_URL}/dashboard/reservations?r=${encodeURIComponent(restaurantId)}`;
}

export async function enqueueBusinessNotifications(
  tx: Tx,
  args: {
    restaurantId: string;
    reservationId: string;
    event: BusinessEvent;
    restaurantName: string;
    whenLabel: string;
    partySize: number;
    /** Çelës versioni për ndryshimin e orarit (instanti i ri) — çdo ndryshim është event i veçantë. */
    version?: string;
  }
): Promise<number> {
  const [settings, recipients, owner] = await Promise.all([
    tx.bookingSettings.findUnique({ where: { restaurantId: args.restaurantId }, select: { notifyEmailEnabled: true, notifyWhatsappEnabled: true } }),
    tx.notificationRecipient.findMany({
      where: { restaurantId: args.restaurantId, enabled: true, verifiedAt: { not: null } },
      select: { id: true, channel: true, address: true, consentAt: true },
    }),
    tx.restaurant.findUnique({ where: { id: args.restaurantId }, select: { owner: { select: { email: true, emailVerified: true } } } }),
  ]);
  const emailOn = settings?.notifyEmailEnabled ?? true;
  const whatsappOn = settings?.notifyWhatsappEnabled ?? false;

  const targets: { channel: "Email" | "WhatsApp"; address: string; recipientId: string | null }[] = [];
  if (emailOn) {
    const emails = recipients.filter((r) => r.channel === "Email");
    if (emails.length) emails.forEach((r) => targets.push({ channel: "Email", address: r.address, recipientId: r.id }));
    else if (owner?.owner.email && owner.owner.emailVerified) targets.push({ channel: "Email", address: owner.owner.email, recipientId: null });
  }
  if (whatsappOn) {
    recipients
      .filter((r) => r.channel === "WhatsApp" && r.consentAt)
      .forEach((r) => targets.push({ channel: "WhatsApp", address: r.address, recipientId: r.id }));
  }

  const payload = {
    restaurantName: args.restaurantName,
    when: args.whenLabel,
    partySize: args.partySize,
    ref: bookingReference(args.reservationId),
    panelUrl: panelReservationsUrl(args.restaurantId),
  };
  const version = args.version ? `:${args.version}` : "";
  for (const t of targets) {
    await enqueueJob(tx, {
      restaurantId: args.restaurantId,
      reservationId: args.reservationId,
      type: TYPE[args.event],
      channel: t.channel,
      recipientId: t.recipientId,
      recipient: t.address,
      payload,
      dedupeKey: `biz:${args.event}:${args.reservationId}${version}:${t.channel}:${t.recipientId ?? "owner"}`,
    });
  }
  return targets.length;
}
