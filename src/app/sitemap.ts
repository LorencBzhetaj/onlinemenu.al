import type { MetadataRoute } from "next";
import { SITE_URL, isProductionDeploy } from "@/lib/site-config";

// Vetëm URL-ja publike, kanonike dhe e gatshme për indeksim gjatë fazës "Së shpejti".
export default function sitemap(): MetadataRoute.Sitemap {
  if (!isProductionDeploy()) return [];
  return [{ url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 }];
}
