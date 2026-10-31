import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setModuleStatus, type SetModuleResult } from "@/modules/subscriptions/modules";
import { recordAuditTx } from "@/modules/admin/audit";

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

  // ATOMIK (Faza 8): ndryshimi i modulit + audit-i në NJË transaksion. Nëse audit-i
  // dështon, ndryshimi i modulit rrëzohet (kurrë mutacion admin pa gjurmë).
  const res: SetModuleResult = await prisma.$transaction(async (tx) => {
    const r = await setModuleStatus({ restaurantId: params.id, module: moduleName, status }, tx);
    if (!r.ok) return r; // asnjë shkrim → asnjë audit
    await recordAuditTx(tx, {
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      actorRole: "SUPER_ADMIN",
      restaurantId: params.id,
      action: status === "active" ? "module.activate" : "module.disable",
      targetType: "ModuleEntitlement",
      targetId: `${params.id}:${moduleName}`,
      summary: `Moduli ${moduleName} → ${status}`,
    });
    return r;
  });

  if (!res.ok) {
    const code = res.error === "no_subscription" ? 409 : 400;
    return NextResponse.json({ error: res.error }, { status: code });
  }

  return NextResponse.json({ ok: true, module: res.module, status: res.status });
}
