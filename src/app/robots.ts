import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * robots (Faza 6): zonat private dhe tokenet nuk indeksohen. Profilet publike dhe
 * kërkimi lejohen. /bookings mban token → noindex edhe në nivel faqeje.
 */
export default function robots(): MetadataRoute.Robots {
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
