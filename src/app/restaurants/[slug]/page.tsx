import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProfile } from "@/modules/restaurants/public-profile";
import { publicThemeVars, publicFontsHref } from "@/lib/public-theme";
import { RestaurantProfile } from "@/components/public/restaurant-profile";
import { PublicTabs } from "@/components/public/public-tabs";
import { Unavailable } from "@/components/public/unavailable";
import { PublicFonts } from "@/components/public/public-fonts";
import { restaurantJsonLd } from "@/modules/restaurants/structured-data";
import { absoluteUrl } from "@/lib/site";
import { OmSiteHeader } from "@/components/public/om-site-header";
import { OmSiteFooter } from "@/components/public/om-site-footer";
import { resolveRestaurantCoords, directionsUrl, routingServiceUrl } from "@/modules/restaurants/location";
import "@/components/public/profile.css";
import "@/components/public/menu.css";
import "@/components/public/om-public.css";

// Dinamike: gate-i (publikim/pezullim/entitlement) reflektohet menjëherë, pa cache i vjetruar.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPublicProfile(params.slug);
  if (!p) return { title: "Restoranti" };
  const url = absoluteUrl(`/restaurants/${p.slug}`);
  const description = p.subtitleAl ?? p.taglineAl ?? `${p.name}${p.address ? ` — ${p.address}` : ""}`;
  // Profilet e fshehura (jo të publikuara / të pezulluara) nuk indeksohen.
  const hidden = !p.gate.isPublished || p.gate.suspended;
  return {
    title: p.name,
    description,
    alternates: { canonical: url },
    robots: hidden ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      title: p.name,
      description,
      url,
      ...(p.logoUrl ? { images: [p.logoUrl.startsWith("http") ? p.logoUrl : absoluteUrl(p.logoUrl)] } : {}),
    },
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
  const mapsLink = p.links.find((l) => l.type === "MAPS")?.url ?? p.mapsUrl ?? null;
  const coords = resolveRestaurantCoords({ latitude: p.latitude, longitude: p.longitude, mapsLink });

  return (
    <div className="rprofile om-page" style={themeVars}>
      {/* Structured data: të dhëna reale (pa ratings të sajuara). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd(p)) }}
      />
      <PublicFonts href={publicFontsHref(p)} />
      <OmSiteHeader />
      <RestaurantProfile
        profile={{
          coverUrl: p.coverUrl,
          city: p.city,
          cuisine: p.cuisine,
          address: p.address,
          location: {
            coords,
            mapsLink,
            directionsHref: directionsUrl({ coords, address: p.address }),
            routingUrl: routingServiceUrl(),
          },
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
          // BOOKING aktiv → formulari i brendshëm; përndryshe butoni nuk shfaqet.
          reserveHref: p.gate.bookingActive ? `/restaurants/${p.slug}/reserve` : null,
        }}
      />
      <OmSiteFooter />
      <PublicTabs slug={p.slug} active="profile" labels={{ profile: "Restoranti", menu: "Menuja", info: "Informacion" }} />
    </div>
  );
}
