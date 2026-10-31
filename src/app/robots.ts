import type { MetadataRoute } from "next";
import { absoluteUrl, indexingAllowed } from "@/lib/site";

// Dinamik: `NOINDEX`/`VERCEL_ENV` lexohen në runtime (jo të ngurtësuara në build), që
// staging/Preview të de-indeksohen edhe nëse artefakti i build-it ripërdoret.
export const dynamic = "force-dynamic";

/**
 * robots (Faza 6 + 8): zonat private dhe tokenet nuk indeksohen. Profilet publike dhe
 * kërkimi lejohen në PROD. Në staging/Preview (`NOINDEX=1` ose VERCEL_ENV≠production)
 * → disallow i plotë, pa sitemap, që mjedisi jo-prod të mos indeksohet.
 */
export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/admin", "/onboarding", "/bookings", "/verify-email", "/reset-password", "/forgot-password"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
