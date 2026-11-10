import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/modules/booking/availability";
import { toBusinessDateKey, businessTimeOfDay } from "@/modules/booking/timezone";
import { publicThemeVars, publicFontsHref } from "@/lib/public-theme";
import { PublicFonts } from "@/components/public/public-fonts";
import { CancelBooking } from "@/components/public/cancel-booking";
import { OmSiteHeader } from "@/components/public/om-site-header";
import "@/components/public/profile.css";
import "@/components/public/om-public.css";

export const dynamic = "force-dynamic";

// Token/PII → nuk indeksohet kurrë (masterplan §4).
export const metadata: Metadata = { title: "Rezervimi juaj", robots: { index: false, follow: false } };

async function getBooking(token: string) {
  return prisma.reservation.findUnique({
    where: { cancelToken: token },
    select: {
      id: true, status: true, partySize: true, startDateTime: true, notes: true, restaurantId: true,
      restaurant: { select: { name: true, slug: true, phone: true, primaryColor: true, accentColor: true, fontHeading: true, fontBody: true } },
    },
  });
}

export default async function BookingPage({ params }: { params: { token: string } }) {
  const b = await getBooking(params.token);
  if (!b) notFound();

  const settings = await getSettings(b.restaurantId);
  const tz = settings.timezone;
  const dateKey = toBusinessDateKey(b.startDateTime, tz);
  const time = businessTimeOfDay(b.startDateTime, tz);
  const cancelled = b.status === "Cancelled";

  return (
    <div className="rprofile om-page" style={publicThemeVars(b.restaurant)}>
      <PublicFonts href={publicFontsHref(b.restaurant)} />
      <OmSiteHeader />
      <header className="rprofile-hero">
        <h1 style={{ fontSize: "1.8rem" }}>{b.restaurant.name}</h1>
        <div className="rprofile-subtitle">Rezervimi juaj</div>
      </header>

      <div className="bk-wrap">
        <div className="bk-card">
          <div className="bk-row"><span className="k">Statusi</span><span className="v"><span className={`bk-status ${cancelled ? "cancelled" : "ok"}`}>{cancelled ? "I anuluar" : "I konfirmuar"}</span></span></div>
          <div className="bk-row"><span className="k">Data</span><span className="v">{dateKey}</span></div>
          <div className="bk-row"><span className="k">Ora</span><span className="v">{time}</span></div>
          <div className="bk-row"><span className="k">Persona</span><span className="v">{b.partySize}</span></div>
          {b.notes && <div className="bk-row"><span className="k">Shënim</span><span className="v">{b.notes}</span></div>}

          {!cancelled && (
            <div className="bk-actions">
              <a className="rsv-btn" href={`/bookings/${params.token}/calendar.ics`}>Shto në kalendar</a>
              <CancelBooking token={params.token} summary={`${b.restaurant.name} · ${dateKey} · ${time} · ${b.partySize} persona`} />
              <p style={{ fontFamily: "var(--font-ui)", fontSize: "0.8rem", color: "var(--ink-soft)", textAlign: "center", margin: "6px 0 0" }}>
                Për të ndryshuar orën ose personat, kontaktoni restorantin{b.restaurant.phone ? ` në ${b.restaurant.phone}` : ""}.
                Riplanifikimin e bën stafi.
              </p>
            </div>
          )}

          <p style={{ fontFamily: "var(--font-ui)", fontSize: "0.78rem", color: "var(--ink-soft)", textAlign: "center", marginTop: 18 }}>
            <a href={`/restaurants/${b.restaurant.slug}`} style={{ color: "var(--brand)" }}>← Kthehu te {b.restaurant.name}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
