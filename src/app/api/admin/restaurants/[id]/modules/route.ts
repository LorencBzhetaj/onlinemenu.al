import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setModuleStatus } from "@/modules/subscriptions/modules";
import { recordAudit } from "@/modules/admin/audit";

/**
 * Aktivizim/çaktivizim i NDARË i modulit MENU/BOOKING për NJË restorant. VETËM SUPER_ADMIN.
 * Kurrë aktivizim global. Regjistron audit (module.activate / module.disable).
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!restaurant) return NextResponse.json({ error: "Restoranti nuk u gjet." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const moduleName = String(body.module ?? "").trim();
  const status = String(body.status ?? "").trim();

  const res = await setModuleStatus({ restaurantId: params.id, module: moduleName, status });
  if (!res.ok) {
    const code = res.error === "no_subscription" ? 409 : 400;
    return NextResponse.json({ error: res.error }, { status: code });
  }

  await recordAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: "SUPER_ADMIN",
    restaurantId: params.id,
    action: status === "active" ? "module.activate" : "module.disable",
    targetType: "ModuleEntitlement",
    targetId: `${params.id}:${moduleName}`,
    summary: `Moduli ${moduleName} → ${status}`,
  });

  return NextResponse.json({ ok: true, module: res.module, status: res.status });
}
