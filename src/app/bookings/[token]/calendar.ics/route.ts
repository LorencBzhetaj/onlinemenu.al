import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function icsDate(d: Date): string {
  // UTC bazë (Z) — kalendarët e konvertojnë në zonën e përdoruesit.
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string): string {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/** Skedar .ics për "Shto në kalendar" (vetëm rezervime jo të anuluara). */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const b = await prisma.reservation.findUnique({
    where: { cancelToken: params.token },
    select: { status: true, partySize: true, startDateTime: true, endDateTime: true, restaurant: { select: { name: true, address: true } } },
  });
  if (!b || b.status === "Cancelled") {
    return new Response("Not found", { status: 404 });
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//onlinemenu.al//booking//SQ",
    "BEGIN:VEVENT",
    `UID:${params.token}@onlinemenu.al`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(b.startDateTime)}`,
    `DTEND:${icsDate(b.endDateTime)}`,
    `SUMMARY:${esc(`Rezervim · ${b.restaurant.name} (${b.partySize} persona)`)}`,
    b.restaurant.address ? `LOCATION:${esc(b.restaurant.address)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rezervim.ics"`,
    },
  });
}
