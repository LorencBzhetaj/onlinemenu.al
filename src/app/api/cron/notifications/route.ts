import { NextResponse } from "next/server";
import { runNotificationWorker } from "@/modules/booking/notifications";

export const dynamic = "force-dynamic";

/**
 * Cron i njoftimeve: përpunon job-et e gatshme (konfirmime të vonuara, kujtesa të
 * planifikuara, retry pas dështimeve). Siguri: "Authorization: Bearer <CRON_SECRET>".
 * Dërguesi real konfigurohet në prod; këtu (pa RESEND real) dërgimet simulohen.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "I paautorizuar." }, { status: 401 });
  }
  const result = await runNotificationWorker({ limit: 200 });
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
