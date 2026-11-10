import { NextResponse } from "next/server";
import { getPublicProfile } from "@/modules/restaurants/public-profile";
import { createReservation } from "@/modules/booking/reservations";
import { flushNotificationsAfterCommit } from "@/modules/booking/notifications";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Krijim rezervimi publik. BOOKING aktiv + rate limit + idempotency. Njoftimet krijohen
 * në transaksionin e rezervimit; worker-i i dërgon PAS commit-it (best-effort këtu, plus cron).
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const p = await getPublicProfile(params.slug);
  if (!p) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!p.gate.isPublished || p.gate.suspended || !p.gate.bookingActive) {
    return NextResponse.json({ ok: false, error: "Rezervimet nuk janë aktive." }, { status: 403 });
  }

  // Max 8 përpjekje rezervimi për minutë për IP (fail-open: disponueshmëri).
  if (!(await rateLimit(`resv:${clientIp(req)}`, 8, 60_000))) {
    return NextResponse.json({ ok: false, error: "Shumë kërkesa. Provoni pak më vonë." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const res = await createReservation({
    restaurantId: p.id,
    start: String(body.start ?? ""),
    partySize: Number(body.partySize),
    firstName: String(body.firstName ?? ""),
    lastName: body.lastName ? String(body.lastName) : undefined,
    phone: String(body.phone ?? ""),
    email: body.email ? String(body.email) : undefined,
    notes: body.notes ? String(body.notes) : undefined,
    requestedArea: body.requestedArea,
    idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey) : undefined,
    tableId: "any",
  });

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });

  // Dërgo njoftimet pas commit-it (best-effort; dështimi s'e prish rezervimin).
  await flushNotificationsAfterCommit(p.id);

  return NextResponse.json({
    ok: true,
    reservationId: res.data!.reservationId,
    cancelToken: res.data!.cancelToken,
    manageUrl: `${BASE}/bookings/${res.data!.cancelToken}`,
  }, { status: 201 });
}
