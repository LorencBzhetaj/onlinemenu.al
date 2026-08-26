import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Platforma e Menusë Digjitale",
  description:
    "Menu digjitale premium për restorante — QR, personalizim vizual, dygjuhëshe (AL/EN).",
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
  themeColor: "#17181A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sq">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
