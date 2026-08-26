import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Cron ditor (Vercel: "0 3 * * *") për PASTRIM/KONSISTENCË të statuseve.
 * Kalon në "expired" çdo abonim që ka skaduar por ende figuron active/trial.
 *
 * SHËNIM: gate-i publik tashmë punon "live" pa këtë cron — ky është vetëm që
 * admin-i të shohë statuse të sakta te lista, jo për mbrojtjen e faqes publike.
 *
 * SigurT: Vercel Cron dërgon "Authorization: Bearer <CRON_SECRET>" kur
 * CRON_SECRET është vendosur si env variabël. Refuzon çdo thirrje tjetër.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }

  const now = new Date();
  const result = await prisma.subscription.updateMany({
    where: {
      expiresAt: { lt: now },
      status: { in: ["active", "trial"] },
    },
    data: { status: "expired" },
  });

  return NextResponse.json({
    ok: true,
    expired: result.count,
    ranAt: now.toISOString(),
  });
}
