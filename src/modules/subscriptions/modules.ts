import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ALLOWED_MODULE, ALLOWED_MODULE_STATUS } from "@/lib/subscription";

export type ModuleName = "MENU" | "BOOKING";
export type ModuleStatus = "active" | "disabled" | "expired";

export type SetModuleResult =
  | { ok: true; module: string; status: string }
  | { ok: false; error: "bad_module" | "bad_status" | "no_subscription" };

/**
 * Aktivizim/çaktivizim i NDARË i modulit (MENU/BOOKING) për NJË restorant (Faza 7).
 * Kurrë aktivizim global: vepron vetëm mbi entitlement-in e këtij abonimi. Opsionalisht
 * vendos një `expiresAt` për modulin (null = pa skadim moduli → qeveris abonimi).
 */
export async function setModuleStatus(
  params: {
    restaurantId: string;
    module: string;
    status: string;
    expiresAt?: Date | null;
  },
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<SetModuleResult> {
  if (!ALLOWED_MODULE.has(params.module)) return { ok: false, error: "bad_module" };
  if (!ALLOWED_MODULE_STATUS.has(params.status)) return { ok: false, error: "bad_status" };

  const sub = await client.subscription.findUnique({
    where: { restaurantId: params.restaurantId },
    select: { id: true },
  });
  if (!sub) return { ok: false, error: "no_subscription" };

  await client.moduleEntitlement.upsert({
    where: { subscriptionId_module: { subscriptionId: sub.id, module: params.module } },
    update: { status: params.status, expiresAt: params.expiresAt ?? null },
    create: { subscriptionId: sub.id, module: params.module, status: params.status, expiresAt: params.expiresAt ?? null },
  });

  return { ok: true, module: params.module, status: params.status };
}

export type ModuleView = { module: string; status: string; expiresAt: Date | null };

/** Gjendja e moduleve të një restoranti (për admin). */
export async function listModules(restaurantId: string): Promise<ModuleView[]> {
  const sub = await prisma.subscription.findUnique({
    where: { restaurantId },
    select: { entitlements: { select: { module: true, status: true, expiresAt: true } } },
  });
  if (!sub) return [];
  const order = ["MENU", "BOOKING"];
  return sub.entitlements
    .map((e) => ({ module: e.module, status: e.status, expiresAt: e.expiresAt }))
    .sort((a, b) => order.indexOf(a.module) - order.indexOf(b.module));
}
