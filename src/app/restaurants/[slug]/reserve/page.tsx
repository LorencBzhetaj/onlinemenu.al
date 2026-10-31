import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile } from "@/modules/restaurants/public-profile";
import { getSettings } from "@/modules/booking/availability";
import { publicThemeVars, publicFontsHref } from "@/lib/public-theme";
import { PublicFonts } from "@/components/public/public-fonts";
import { PublicTabs } from "@/components/public/public-tabs";
import { Unavailable } from "@/components/public/unavailable";
import { ReserveFlow } from "@/components/public/reserve-flow";
import "@/components/public/profile.css";
import "@/components/public/menu.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPublicProfile(params.slug);
  return { title: p ? `${p.name} — Rezervo` : "Rezervo" };
}

export default async function ReservePage({ params }: { params: { slug: string } }) {
  const p = await getPublicProfile(params.slug);
  if (!p) notFound();
  // Rezervimi publik kërkon: i publikuar, jo i pezulluar, DHE BOOKING aktiv.
  if (!p.gate.isPublished || p.gate.suspended || !p.gate.bookingActive) {
    return <Unavailable name={p.name} />;
  }
  const settings = await getSettings(p.id);

  return (
    <div className="rprofile" style={publicThemeVars(p)}>
      <PublicFonts href={publicFontsHref(p)} />
      <header className="rprofile-hero" style={{ padding: "40px 22px 32px" }}>
        <h1 style={{ fontSize: "2rem" }}>{p.name}</h1>
        <div className="rprofile-subtitle">Rezervo një tavolinë</div>
      </header>
      <ReserveFlow slug={p.slug} maxPartySize={settings.maxPartySize} timezone={settings.timezone} />
      <PublicTabs slug={p.slug} active="profile" labels={{ profile: "Restoranti", menu: "Menuja", info: "Informacion" }} />
    </div>
  );
}
