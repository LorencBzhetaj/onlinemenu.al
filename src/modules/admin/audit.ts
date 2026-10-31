import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * AuditLog (Faza 7) — regjistron mutacionet administrative dhe ndryshimet kritike të
 * roleve/abonimeve: KUSH (aktori), ÇFARË (veprimi), KU (restoranti), KUR.
 *
 * NUK regjistron kurrë sekrete, token apo password. `summary` duhet të jetë përshkrim i
 * shkurtër pa të dhëna të ndjeshme. Shkrimi është best-effort: një dështim i audit-it
 * NUK e rrëzon veprimin kryesor (log-ohet gabimi dhe vazhdohet).
 */
export type AuditInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  restaurantId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary?: string | null;
};

const MAX_SUMMARY = 300;

function auditData(input: AuditInput) {
  return {
    actorUserId: input.actorUserId ?? null,
    actorEmail: input.actorEmail ?? null,
    actorRole: input.actorRole ?? null,
    restaurantId: input.restaurantId ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    summary: input.summary ? input.summary.slice(0, MAX_SUMMARY) : null,
  };
}

/**
 * ATOMIK (Faza 8) — për mutacionet KRITIKE (role/abonime/module/ftesa). Thirret BRENDA
 * të njëjtit `$transaction` me veprimin dhe NUK e kap gabimin: nëse shkrimi i audit-it
 * dështon, i gjithë transaksioni (veprimi + audit) rrëzohet → kurrë veprim pa gjurmë,
 * kurrë gjurmë pa veprim. `client` DUHET të jetë klienti i transaksionit.
 */
export async function recordAuditTx(client: Prisma.TransactionClient, input: AuditInput): Promise<void> {
  await client.auditLog.create({ data: auditData(input) });
}

/**
 * BEST-EFFORT — për regjistrim jo-kritik/fire-and-forget: një dështim i audit-it NUK e
 * rrëzon veprimin kryesor (log-ohet dhe vazhdohet). Për mutacione kritike përdor
 * `recordAuditTx` brenda transaksionit të veprimit.
 */
export async function recordAudit(input: AuditInput, client: Prisma.TransactionClient | typeof prisma = prisma): Promise<void> {
  try {
    await client.auditLog.create({ data: auditData(input) });
  } catch (e) {
    // Audit-i best-effort s'duhet të rrëzojë veprimin kryesor.
    console.error("audit.record.failed", input.action, e);
  }
}

export type AuditEntry = {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  restaurantId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string | null;
  createdAt: Date;
};

/** Listim i audit-it (për admin). Opsionalisht filtruar sipas restoranti/veprimi. */
export async function listAudit(opts: { restaurantId?: string; action?: string; limit?: number } = {}): Promise<AuditEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(opts.restaurantId ? { restaurantId: opts.restaurantId } : {}),
      ...(opts.action ? { action: opts.action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, actorEmail: true, actorRole: true, restaurantId: true,
      action: true, targetType: true, targetId: true, summary: true, createdAt: true,
    },
  });
  return rows;
}
