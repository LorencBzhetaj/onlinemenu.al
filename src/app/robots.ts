import type { MetadataRoute } from "next";
import { SITE_URL, isProductionDeploy } from "@/lib/site-config";

// Production: lejohet vetëm kryefaqja (rrugët e tjera janë 404). Preview/zhvillim: asgjë s'indeksohet.
export default function robots(): MetadataRoute.Robots {
  if (!isProductionDeploy()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
