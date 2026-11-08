import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SITE_URL, indexingAllowed } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Platforma e Menusë Digjitale",
    template: "%s · MenuDigjitale",
  },
  description:
    "Menu digjitale premium për restorante — QR, personalizim vizual, dygjuhëshe (AL/EN).",
  // Staging/Preview (NOINDEX=1 ose VERCEL_ENV≠production): meta noindex global si mbrojtje
  // shtesë ndaj robots.txt (për crawler që e injorojnë robots.txt).
  ...(indexingAllowed() ? {} : { robots: { index: false, follow: false } }),
  // PWA: lejon ruajtjen e menusë në ekranin bazë (skanim QR në tryezë).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Menu",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

// viewport-fit=cover + theme-color (nga përmirësimet PWA të deploy-it ekzistues).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF8F3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sq">
      <head>
        {/* Fontet e platformës: Playfair Display (tituj) + Jost (UI). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&family=Playfair+Display:wght@500;600;700&family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
