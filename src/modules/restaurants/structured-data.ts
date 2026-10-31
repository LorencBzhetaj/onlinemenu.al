import type { PublicProfile } from "./public-profile";
import { absoluteUrl } from "@/lib/site";

/**
 * JSON-LD schema.org/Restaurant me TË DHËNA REALE vetëm (Faza 6).
 * Pa aggregateRating/priceRange të sajuar; fushat mungesore hiqen plotësisht.
 */
export function restaurantJsonLd(p: PublicProfile): Record<string, unknown> {
  const url = absoluteUrl(`/restaurants/${p.slug}`);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": url,
    name: p.name,
    url,
    hasMenu: absoluteUrl(`/restaurants/${p.slug}/menu`),
    acceptsReservations: p.gate.bookingActive,
  };

  if (p.logoUrl) data.image = p.logoUrl.startsWith("http") ? p.logoUrl : absoluteUrl(p.logoUrl);
  if (p.phone) data.telephone = p.phone;
  if (p.cuisine) data.servesCuisine = p.cuisine;

  if (p.address || p.city) {
    const addr: Record<string, unknown> = { "@type": "PostalAddress", addressCountry: "AL" };
    if (p.address) addr.streetAddress = p.address;
    if (p.city) addr.addressLocality = p.city;
    data.address = addr;
  }

  const sameAs = p.links.filter((l) => /^https?:\/\//i.test(l.url)).map((l) => l.url);
  if (sameAs.length > 0) data.sameAs = sameAs;

  return data;
}
