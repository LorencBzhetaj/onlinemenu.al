import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile, reserveDestination } from "@/modules/restaurants/public-profile";
import { publicThemeVars, publicFontsHref } from "@/lib/public-theme";
import { RestaurantProfile } from "@/components/public/restaurant-profile";
import { PublicTabs } from "@/components/public/public-tabs";
import { Unavailable } from "@/components/public/unavailable";
import { PublicFonts } from "@/components/public/public-fonts";
import "@/components/public/profile.css";
import "@/components/public/menu.css";

// Dinamike: gate-i (publikim/pezullim/entitlement) reflektohet menjëherë, pa cache i vjetruar.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPublicProfile(params.slug);
  if (!p) return { title: "Restoranti" };
  return {
    title: p.name,
    description: p.subtitleAl ?? p.taglineAl ?? `${p.name}${p.address ? ` — ${p.address}` : ""}`,
  };
}

export default async function RestaurantProfilePage({ params }: { params: { slug: string } }) {
  const p = await getPublicProfile(params.slug);
  if (!p) notFound();

  // Profili shfaqet vetëm kur është i publikuar DHE jo i pezulluar (ndryshe nga MENU joaktiv,
  // ku profili mbetet publik me njoftim). Pezullimi/mospublikimi e fsheh profilin.
  if (!p.gate.isPublished || p.gate.suspended) {
    return <Unavailable name={p.name} />;
  }

  const themeVars = publicThemeVars(p);

  return (
    <div className="rprofile" style={themeVars}>
      <PublicFonts href={publicFontsHref(p)} />
      <RestaurantProfile
        profile={{
          slug: p.slug,
          name: p.name,
          logoUrl: p.logoUrl,
          estYear: p.estYear,
          taglineAl: p.taglineAl,
          taglineEn: p.taglineEn,
          subtitleAl: p.subtitleAl,
          subtitleEn: p.subtitleEn,
          aboutAl: p.aboutAl,
          aboutEn: p.aboutEn,
          phone: p.phone,
          links: p.links,
          menuActive: p.gate.menuActive,
          reserveHref: reserveDestination({ gate: p.gate, whatsapp: p.whatsapp, phone: p.phone, name: p.name }),
        }}
      />
      <PublicTabs slug={p.slug} active="profile" labels={{ profile: "Restoranti", menu: "Menuja", info: "Informacion" }} />
    </div>
  );
}
