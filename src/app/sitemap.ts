import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Sitemap (Faza 6): VETËM faqe publike + profile të publikuara dhe jo të pezulluara.
 * Pa panel, pa /bookings/[token] (noindex), pa reserve (gjendje kalimtare), pa API.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const restaurants = await prisma.restaurant.findMany({
    where: { isPublished: true, suspendedAt: null },
    select: { slug: true, updatedAt: true },
    orderBy: { name: "asc" },
  });

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/restaurants"), changeFrequency: "daily", priority: 0.9 },
  ];

  const profileEntries: MetadataRoute.Sitemap = restaurants.flatMap((r) => [
    { url: absoluteUrl(`/restaurants/${r.slug}`), lastModified: r.updatedAt, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl(`/restaurants/${r.slug}/menu`), lastModified: r.updatedAt, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl(`/restaurants/${r.slug}/info`), lastModified: r.updatedAt, changeFrequency: "monthly", priority: 0.4 },
  ]);

  return [...staticEntries, ...profileEntries];
}
