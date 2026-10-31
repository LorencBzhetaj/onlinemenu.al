import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile } from "@/modules/restaurants/public-profile";
import { publicThemeVars, publicFontsHref } from "@/lib/public-theme";
import { RestaurantInfo } from "@/components/public/restaurant-info";
import { PublicTabs } from "@/components/public/public-tabs";
import { PublicFonts } from "@/components/public/public-fonts";
import { Unavailable } from "@/components/public/unavailable";
import "@/components/public/profile.css";
import "@/components/public/menu.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPublicProfile(params.slug);
  if (!p) return { title: "Informacion" };
  return { title: `${p.name} — Informacion`, description: `Informacion & kontakt — ${p.name}.` };
}

export default async function RestaurantInfoPage({ params }: { params: { slug: string } }) {
  const p = await getPublicProfile(params.slug);
  if (!p) notFound();

  // Informacioni mbetet publik edhe kur MENU është joaktiv; kërkon vetëm publikim + jo pezullim.
  if (!p.gate.isPublished || p.gate.suspended) {
    return <Unavailable name={p.name} />;
  }

  return (
    <div className="rprofile" style={publicThemeVars(p)}>
      <PublicFonts href={publicFontsHref(p)} />
      <RestaurantInfo
        info={{
          name: p.name,
          address: p.address,
          phone: p.phone,
          whatsapp: p.whatsapp,
          aboutAl: p.aboutAl,
          aboutEn: p.aboutEn,
          links: p.links,
          reserveHref: p.gate.bookingActive ? `/restaurants/${p.slug}/reserve` : null,
        }}
      />
      <PublicTabs slug={p.slug} active="info" labels={{ profile: "Restoranti", menu: "Menuja", info: "Informacion" }} />
    </div>
  );
}
