import { existsSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SplashScreen, CHEF_BOX_ASSET_PATH } from "@/components/public/splash-screen";
import { hasChefAsset } from "@/components/public/chef-mascot";
import "@/components/public/om-public.css";

// Pamje LOKALE e ekranit të hapjes (Splash B 05) për kontroll vizual.
// Vetëm në zhvillim: në build prodhimi kthen 404 dhe s'indeksohet.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pamje lokale — ekrani i hapjes", robots: { index: false, follow: false } };

export default function SplashPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const onDisk = existsSync(path.join(process.cwd(), "public", CHEF_BOX_ASSET_PATH));
  const registered = hasChefAsset("box");

  return (
    <>
      <SplashScreen />
      <aside className="om-dev-note" aria-label="Gjendja e ilustrimit">
        <strong>Pamje lokale · Splash B 05</strong>
        <span>
          Ilustrimi final: <code>public{CHEF_BOX_ASSET_PATH}</code> —{" "}
          {onDisk ? (registered ? "i pranishëm dhe në përdorim" : "i pranishëm, por s’është regjistruar te CHEF_ASSETS") : "MUNGON (shfaqet silueta vendmbajtëse)"}
        </span>
      </aside>
    </>
  );
}
