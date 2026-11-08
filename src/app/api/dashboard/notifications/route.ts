import { NextResponse } from "next/server";
import { guardRestaurant } from "@/modules/memberships/access";
import { rateLimit } from "@/lib/rate-limit";
import {
  listRecipients,
  addRecipient,
  resendCode,
  verifyRecipient,
  setRecipientEnabled,
  removeRecipient,
  setChannels,
} from "@/modules/booking/notification-recipients";

// "Njoftime rezervimesh" — vetëm OWNER/MANAGER (leja booking:config), tenant-scoped me x-restaurant-id.

export async function GET(req: Request) {
  const g = await guardRestaurant(req, "booking:config");
  if ("error" in g) return g.error;
  return NextResponse.json(await listRecipients(g.ctx.restaurantId));
}

export async function POST(req: Request) {
  const g = await guardRestaurant(req, "booking:config");
  if ("error" in g) return g.error;
  const { restaurantId } = g.ctx;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "add" || action === "resend") {
    if (!(await rateLimit(`notif-code:${restaurantId}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json({ error: "Shumë kode të dërguara. Provoni pas pak." }, { status: 429 });
    }
  }
  switch (action) {
    case "add": {
      const r = await addRecipient(restaurantId, { channel: body.channel, address: body.address, label: body.label, consent: body.consent === true });
      return r.ok ? NextResponse.json(r, { status: 201 }) : NextResponse.json(r, { status: 400 });
    }
    case "resend": {
      const r = await resendCode(restaurantId, String(body.id ?? ""));
      return NextResponse.json(r, { status: r.ok ? 200 : 404 });
    }
    case "verify": {
      const r = await verifyRecipient(restaurantId, String(body.id ?? ""), String(body.code ?? ""));
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case "toggle": {
      const ok = await setRecipientEnabled(restaurantId, String(body.id ?? ""), body.enabled === true);
      return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
    }
    case "remove": {
      const ok = await removeRecipient(restaurantId, String(body.id ?? ""));
      return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
    }
    case "channels": {
      await setChannels(restaurantId, {
        emailEnabled: typeof body.emailEnabled === "boolean" ? body.emailEnabled : undefined,
        whatsappEnabled: typeof body.whatsappEnabled === "boolean" ? body.whatsappEnabled : undefined,
      });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Veprim i panjohur." }, { status: 400 });
  }
}
