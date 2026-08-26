import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_STATUS,
  ALLOWED_PLAN,
  computeExpiresAt,
} from "@/lib/subscription";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  // EKSKLUZIVISHT Super Admin — asnjë RESTAURANT_OWNER, edhe me URL direkte.
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Nuk lejohet." }, { status: 403 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Restoranti nuk u gjet." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "").trim();
  const plan = String(body.plan ?? "").trim();
  const lastPaymentNote = body.lastPaymentNote
    ? String(body.lastPaymentNote).trim().slice(0, 300)
    : null;

  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: "Status i pavlefshëm." }, { status: 400 });
  }
  if (!ALLOWED_PLAN.has(plan)) {
    return NextResponse.json({ error: "Plan i pavlefshëm." }, { status: 400 });
  }

  const existing = await prisma.subscription.findUnique({
    where: { restaurantId: params.id },
    select: { expiresAt: true },
  });

  // Një veprim i vetëm atomik: status + plan + expiresAt + note njëkohësisht.
  const expiresAt = computeExpiresAt(status, plan, existing?.expiresAt ?? null);

  const subscription = await prisma.subscription.upsert({
    where: { restaurantId: params.id },
    update: { status, plan, expiresAt, lastPaymentNote },
    create: {
      restaurantId: params.id,
      status,
      plan,
      expiresAt,
      lastPaymentNote,
      startedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, subscription });
}
