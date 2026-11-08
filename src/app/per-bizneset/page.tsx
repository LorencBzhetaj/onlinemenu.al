import Link from "next/link";
import type { Metadata } from "next";
import { OmSiteHeader } from "@/components/public/om-site-header";
import { OmSiteFooter } from "@/components/public/om-site-footer";
import { TRIAL_DAYS } from "@/modules/restaurants/provision";
import "@/components/public/om-public.css";

export const metadata: Metadata = {
  title: "Për bizneset",
  description: "Menu digjitale, profil publik dhe QR për restorantin tuaj, të përditësuara nga paneli.",
};

// Vetëm veçori që ekzistojnë sot në kod. Rezervimet paraqiten si modul që aktivizohet veçmas.
export default function ForBusinessPage() {
  return (
    <div className="min-h-screen bg-om-white">
      <OmSiteHeader active="business" />
      <main className="om-prose">
        <h1>Për bizneset</h1>
        <p className="om-lead">Menuja dhe profili i restorantit tuaj online, me një QR që nuk ndryshon kurrë.</p>

        <h2>Çfarë ofron OnlineMenu sot</h2>
        <h3>Menu digjitale</h3>
        <ul>
          <li>Kategori dhe nënkategori, me çmime në ALL.</li>
          <li>Emër dhe përshkrim në shqip dhe anglisht; vizitori zgjedh gjuhën.</li>
          <li>Foto të pjatave (opsionale), alergjenët, pjata të rekomanduara dhe shënimi “përkohësisht i padisponueshëm”.</li>
          <li>Orare menuje (p.sh. mëngjes/drekë) dhe menu degustuese.</li>
        </ul>
        <h3>Profil publik</h3>
        <ul>
          <li>Logo, foto kopertine opsionale, përshkrim, telefon dhe adresë.</li>
          <li>Lidhje me Wolt, Instagram, faqen tuaj dhe hartën; butoni Wolt shfaqet vetëm me lidhje të vlefshme.</li>
          <li>Vendndodhja me pin në hartë kur vendosni koordinatat.</li>
        </ul>
        <h3>QR</h3>
        <ul>
          <li>Kod QR për tavolinat që hap profilin e restorantit. Kodi mbetet i njëjtë kur ndryshoni emrin ose menunë.</li>
        </ul>
        <h3>Përditësim nga paneli</h3>
        <ul>
          <li>Ndryshoni menunë, çmimet, fotot dhe profilin nga paneli; vizitorët shohin versionin e ri pa ri-printuar QR-në.</li>
          <li>Ftoni anëtarë të ekipit dhe shihni statistika bazë të shikimeve.</li>
        </ul>
        <h3>Rezervime — kur moduli është aktiv</h3>
        <ul>
          <li>Tavolina, zona dhe orare; vizitori zgjedh një orë të lirë dhe merr lidhje për menaxhim/anulim.</li>
          <li>Moduli i rezervimeve s’është aktiv automatikisht me llogarinë e re; aktivizohet veçmas për çdo restorant.</li>
        </ul>

        <h2 id="si-te-behesh-pjese">Si të bëhesh pjesë</h2>
        <ol className="om-steps">
          <li>
            <strong>Krijo llogari</strong>
            Me email dhe fjalëkalim ose me Google. Llogaria e re fillon me {TRIAL_DAYS} ditë provë.
          </li>
          <li>
            <strong>Verifiko email-in</strong>
            Konfirmo adresën me kodin ose lidhjen që të dërgojmë.
          </li>
          <li>
            <strong>Plotëso profilin dhe menunë</strong>
            Shto logon, kontaktet, kategoritë dhe pjatat nga paneli.
          </li>
          <li>
            <strong>Publiko dhe shpërnda QR-në</strong>
            Aktivizo profilin publik, shkarko QR-në dhe vendose në tavolina.
          </li>
        </ol>
        <div className="om-cta-row">
          <Link href="/register" className="om-btn om-btn--reserve">
            Regjistro biznesin
          </Link>
          <Link href="/login" className="om-btn om-btn--ghost">
            Kam llogari — Hyr
          </Link>
        </div>
      </main>
      <OmSiteFooter />
    </div>
  );
}
