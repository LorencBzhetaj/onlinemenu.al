// Marrësit e "Njoftime rezervimesh" (tenant-scoped). Email ose WhatsApp; dërgohet vetëm pasi
// marrësi verifikohet me kod (6 shifra, hash, 15 min, 5 tentativa). WhatsApp kërkon pëlqimin
// e marrësit. Kanalet e simuluara kthejnë kodin vetëm për provë (s'dërgohet asgjë reale).
import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { defaultNotificationSender, defaultWhatsAppSender, simulateSender, type NotificationChannel, type NotifySender } from "./notifications";

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_RECIPIENTS = 10;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

export function normalizeRecipient(channel: NotificationChannel, raw: string): string | null {
  const v = String(raw ?? "").trim();
  if (channel === "Email") {
    const e = v.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200 ? e : null;
  }
  const digits = v.replace(/[\s\-()]/g, "").replace(/^\+/, "").replace(/^00/, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export function maskAddress(channel: string, address: string): string {
  if (channel === "Email") {
    const [l, d = ""] = address.split("@");
    return `${l.slice(0, 2)}***@${d}`;
  }
  return `+${address.slice(0, 3)}•••${address.slice(-3)}`;
}

function senderFor(channel: NotificationChannel): NotifySender {
  return channel === "WhatsApp" ? defaultWhatsAppSender() : defaultNotificationSender();
}

async function issueCode(id: string, channel: NotificationChannel, address: string, restaurantName: string, send?: NotifySender) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.notificationRecipient.update({
    where: { id },
    data: { codeHash: hash(code), codeExpiresAt: new Date(Date.now() + CODE_TTL_MS), codeAttempts: 0 },
  });
  const sender = send ?? senderFor(channel);
  const out = await sender({
    to: address,
    subject: `Kodi i verifikimit — njoftimet e ${restaurantName}`,
    text: `Kodi juaj për njoftimet e rezervimeve të ${restaurantName}: ${code}\nVlen 15 minuta.`,
  });
  const simulated = sender === simulateSender || Boolean(out.simulated);
  // Kodi kthehet VETËM kur dërgimi është i simuluar (Preview/lokal), për ta provuar rrjedhën.
  return { delivered: out.delivered, simulated, devCode: simulated ? code : undefined };
}

export async function listRecipients(restaurantId: string) {
  const [recipients, settings, recent] = await Promise.all([
    prisma.notificationRecipient.findMany({ where: { restaurantId }, orderBy: { createdAt: "asc" } }),
    prisma.bookingSettings.findUnique({ where: { restaurantId }, select: { notifyEmailEnabled: true, notifyWhatsappEnabled: true } }),
    prisma.notificationJob.findMany({
      where: { restaurantId, type: { startsWith: "Business" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, channel: true, recipient: true, status: true, attempts: true, lastError: true, createdAt: true },
    }),
  ]);
  return {
    settings: { emailEnabled: settings?.notifyEmailEnabled ?? true, whatsappEnabled: settings?.notifyWhatsappEnabled ?? false },
    recipients: recipients.map((r) => ({
      id: r.id,
      channel: r.channel,
      address: maskAddress(r.channel, r.address),
      label: r.label,
      enabled: r.enabled,
      verified: Boolean(r.verifiedAt),
      consent: Boolean(r.consentAt),
    })),
    recent: recent.map((j) => ({ ...j, recipient: maskAddress(j.channel, j.recipient) })),
  };
}

export type AddResult =
  | { ok: true; id: string; simulated: boolean; devCode?: string }
  | { ok: false; error: string };

export async function addRecipient(
  restaurantId: string,
  input: { channel: string; address: string; label?: string; consent?: boolean },
  send?: NotifySender
): Promise<AddResult> {
  const channel = input.channel === "WhatsApp" ? "WhatsApp" : input.channel === "Email" ? "Email" : null;
  if (!channel) return { ok: false, error: "Kanal i pavlefshëm." };
  const address = normalizeRecipient(channel, input.address);
  if (!address) return { ok: false, error: channel === "Email" ? "Email i pavlefshëm." : "Numër i pavlefshëm (formati ndërkombëtar, p.sh. +355…)." };
  if (channel === "WhatsApp" && !input.consent) return { ok: false, error: "Për WhatsApp duhet pëlqimi i marrësit." };
  if ((await prisma.notificationRecipient.count({ where: { restaurantId } })) >= MAX_RECIPIENTS) {
    return { ok: false, error: `Maksimumi ${MAX_RECIPIENTS} marrës.` };
  }
  const r = await prisma.notificationRecipient.upsert({
    where: { restaurantId_channel_address: { restaurantId, channel, address } },
    create: { restaurantId, channel, address, label: input.label?.slice(0, 60) || null, consentAt: channel === "WhatsApp" ? new Date() : null },
    update: { label: input.label?.slice(0, 60) || undefined, ...(channel === "WhatsApp" ? { consentAt: new Date() } : {}) },
  });
  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
  const out = await issueCode(r.id, channel, address, rest?.name ?? "restorantit", send);
  return { ok: true, id: r.id, simulated: out.simulated, devCode: out.devCode };
}

export async function resendCode(restaurantId: string, id: string, send?: NotifySender) {
  const r = await prisma.notificationRecipient.findFirst({ where: { id, restaurantId } });
  if (!r) return { ok: false as const, error: "Marrësi nuk u gjet." };
  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
  const out = await issueCode(r.id, r.channel as NotificationChannel, r.address, rest?.name ?? "restorantit", send);
  return { ok: true as const, simulated: out.simulated, devCode: out.devCode };
}

export async function verifyRecipient(restaurantId: string, id: string, code: string) {
  const r = await prisma.notificationRecipient.findFirst({ where: { id, restaurantId } });
  if (!r || !r.codeHash || !r.codeExpiresAt) return { ok: false as const, error: "Kërkoni një kod të ri." };
  if (r.codeExpiresAt < new Date()) return { ok: false as const, error: "Kodi skadoi. Kërkoni një kod të ri." };
  if (r.codeAttempts >= MAX_ATTEMPTS) return { ok: false as const, error: "Shumë tentativa. Kërkoni një kod të ri." };
  // Rritje atomike e tentativave para krahasimit (mbron nga provat paralele).
  const bumped = await prisma.notificationRecipient.updateMany({
    where: { id: r.id, codeAttempts: { lt: MAX_ATTEMPTS } },
    data: { codeAttempts: { increment: 1 } },
  });
  if (bumped.count !== 1) return { ok: false as const, error: "Shumë tentativa. Kërkoni një kod të ri." };
  if (hash(String(code ?? "").trim()) !== r.codeHash) return { ok: false as const, error: "Kod i pasaktë." };
  await prisma.notificationRecipient.update({ where: { id: r.id }, data: { verifiedAt: new Date(), codeHash: null, codeExpiresAt: null, codeAttempts: 0 } });
  return { ok: true as const };
}

export async function setRecipientEnabled(restaurantId: string, id: string, enabled: boolean) {
  const r = await prisma.notificationRecipient.updateMany({ where: { id, restaurantId }, data: { enabled } });
  return r.count === 1;
}

export async function removeRecipient(restaurantId: string, id: string) {
  const r = await prisma.notificationRecipient.deleteMany({ where: { id, restaurantId } });
  return r.count === 1;
}

export async function setChannels(restaurantId: string, ch: { emailEnabled?: boolean; whatsappEnabled?: boolean }) {
  await prisma.bookingSettings.upsert({
    where: { restaurantId },
    create: { restaurantId, notifyEmailEnabled: ch.emailEnabled ?? true, notifyWhatsappEnabled: ch.whatsappEnabled ?? false },
    update: {
      ...(typeof ch.emailEnabled === "boolean" ? { notifyEmailEnabled: ch.emailEnabled } : {}),
      ...(typeof ch.whatsappEnabled === "boolean" ? { notifyWhatsappEnabled: ch.whatsappEnabled } : {}),
    },
  });
}
