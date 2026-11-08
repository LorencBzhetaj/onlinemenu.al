import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { SITE_URL, isProductionDeploy } from "@/lib/site-config";

// Fontet vetë-hostohen nga next/font (pa kërkesa te Google Fonts nga shfletuesi i vizitorit).
const fredoka = Fredoka({ subsets: ["latin", "latin-ext"], weight: ["600", "700"], variable: "--font-display", display: "swap" });
const nunito = Nunito({ subsets: ["latin", "latin-ext"], weight: ["400", "600", "700"], variable: "--font-text", display: "swap" });

const TITLE = "OnlineMenu.al – Menu digjitale dhe rezervime | Së shpejti";
const DESCRIPTION =
  "OnlineMenu.al po përgatit një platformë për të zbuluar restorante, për të parë menutë digjitale dhe për të rezervuar tavolina te bizneset që e ofrojnë.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  applicationName: "OnlineMenu.al",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "OnlineMenu.al",
    locale: "sq_AL",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  // Vetëm Production indeksohet; Preview mbetet noindex (plus mbrojtja e Vercel).
  robots: isProductionDeploy() ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4A0F35",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className={`${fredoka.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
