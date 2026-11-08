import Link from "next/link";
import type { Metadata } from "next";
import { OmSiteHeader } from "@/components/public/om-site-header";
import { OmSiteFooter } from "@/components/public/om-site-footer";
import "@/components/public/om-public.css";

export const metadata: Metadata = {
  title: "Si funksionon",
  description: "Gjej restorantin me emër, hap menunë ose skano QR-në në tavolinë.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-om-white">
      <OmSiteHeader active="how" />
      <main className="om-prose">
        <h1>Si funksionon</h1>
        <p className="om-lead">Gjen restorantin, hap menunë dhe zgjedh me qetësi — pa aplikacion dhe pa llogari.</p>

        <ol className="om-steps">
          <li>
            <strong>Gjej restorantin</strong>
            Te <Link href="/">Restorantet</Link> kërko me emër ose zgjidh qytetin dhe kuzhinën. Çdo kartë ka butonin “Menuja”; emri ose
            fotoja të çojnë te profili i restorantit.
          </li>
          <li>
            <strong>Hap menunë</strong>
            Menuja ndahet në kategori, ka kërkim për pjatat dhe çmimet në ALL. Mund ta lexosh në shqip ose anglisht. Alergjenët
            shfaqen kur restoranti i ka shtuar.
          </li>
          <li>
            <strong>Skano QR-në në tavolinë</strong>
            Kamera e telefonit e hap kodin QR direkt te profili i restorantit, ku butoni “Menuja” hap menunë. Kodi QR mbetet i njëjtë
            edhe kur restoranti ndryshon menunë.
          </li>
        </ol>

        <h2>Kur shfaqet “Rezervo”</h2>
        <p>
          Butoni “Rezervo” shfaqet vetëm te restorantet që kanë aktivizuar rezervimet. Zgjedh datën, numrin e personave dhe një orë
          të lirë, pastaj vendos emrin dhe telefonin. Pas konfirmimit merr një lidhje për ta parë ose anuluar rezervimin. Nëse jep
          email-in, merr edhe konfirmim me email.
        </p>

        <h2>Kur shfaqet Wolt</h2>
        <p>
          Butoni blu “Wolt ↗” shfaqet vetëm kur restoranti ka shtuar lidhjen e tij në Wolt. Ai hap faqen e Wolt-it në një dritare të
          re; porosia dhe pagesa bëhen atje, jo në OnlineMenu.al.
        </p>

        <h2>Vendndodhja</h2>
        <p>
          Kur restoranti ka plotësuar adresën, profili e shfaq bashkë me “Merr udhëzime”, që hap aplikacionin e hartave. Kur ka edhe
          pin në hartë, shfaqet harta e vogël me vendndodhjen e restorantit.
        </p>

        <div className="om-cta-row">
          <Link href="/" className="om-btn om-btn--menu">
            Gjej një restorant
          </Link>
        </div>
      </main>
      <OmSiteFooter />
    </div>
  );
}
