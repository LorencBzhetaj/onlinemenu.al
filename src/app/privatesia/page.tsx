import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/public/legal-page";
import "@/components/public/om-public.css";

export const metadata: Metadata = {
  title: "Politika e privatësisë",
  robots: { index: false, follow: false }, // draft — s'indeksohet para shqyrtimit
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Politika e privatësisë" version="versioni draft i 8 nëntorit 2026">
      <h2>1. Kush jemi</h2>
      <p>
        OnlineMenu.al është një platformë për menu digjitale, profile publike restorantesh, kode QR dhe — kur moduli është aktiv —
        rezervime tavolinash. Operatori i platformës: <Todo>emri ligjor, NIPT, adresa, email-i i kontaktit për privatësinë</Todo>.
      </p>

      <h2>2. Çfarë të dhënash përpunojmë</h2>
      <h3>Vizitorët e restoranteve (pa llogari)</h3>
      <ul>
        <li>
          <strong>Statistika të anonimizuara të përdorimit.</strong> Kur hapet një profil ose menu, kur klikohet një pjatë ose butoni Wolt,
          ruajmë vetëm restorantin, llojin e veprimit, pjatën (kur ka) dhe kohën. Nuk ruajmë emër, email, adresë IP apo cookie për këtë.
        </li>
        <li>
          <strong>Preferenca e gjuhës</strong> (shqip/anglisht) ruhet vetëm në pajisjen tuaj (localStorage). Shih{" "}
          <Link href="/cookies">Politikën e cookies</Link>.
        </li>
      </ul>
      <h3>Rezervimet (vetëm te restorantet me rezervime aktive)</h3>
      <ul>
        <li>Emri, mbiemri (opsional), telefoni, email-i (opsional), shënimi (opsional), data e ora, numri i personave dhe zona e preferuar.</li>
        <li>Të dhënat i përkasin restorantit ku rezervoni dhe shihen nga stafi i tij në panel.</li>
        <li>
          Pas rezervimit krijohet një lidhje personale për ta parë ose anuluar. Nëse jepni email, dërgojmë konfirmim dhe kujtesë 24 orë
          përpara (kur rezervimi është më larg se 24 orë); restoranti merr gjithashtu njoftim.
        </li>
      </ul>
      <h3>Bizneset (llogaritë e panelit)</h3>
      <ul>
        <li>Email-i, fjalëkalimi (i ruajtur vetëm si hash), roli, emri i restorantit dhe anëtarësitë në ekip.</li>
        <li>Verifikimi i email-it dhe rikuperimi i fjalëkalimit përdorin kode/lidhje me afat; kodet ruhen si hash.</li>
        <li>Hyrja me Google: marrim adresën e email-it nga llogaria Google.</li>
        <li>Përmbajtja që publikoni (emri, adresa, telefoni, logo, foto, menuja, lidhjet) është publike sipas zgjedhjes suaj.</li>
        <li>Regjistër auditimi për veprimet në panel (kush, çfarë veprimi, kur).</li>
      </ul>
      <h3>Siguria</h3>
      <ul>
        <li>
          Për të kufizuar tentativat abuzive përdorim përkohësisht adresën IP (dhe në disa raste email-in) si çelës numërimi për
          regjistrimin, hyrjen/verifikimin, rezervimin, anulimin, rikuperimin e fjalëkalimit dhe ridërgimin e verifikimit.
        </li>
      </ul>

      <h2>3. Qëllimet dhe baza ligjore</h2>
      <p>
        Përdorim të dhënat për të ofruar shërbimin (menu, profil, rezervim, llogari), për siguri dhe për statistika bazë për restorantet.
        Baza ligjore për secilin qëllim: <Todo>përcaktimi nga juristi sipas legjislacionit në fuqi</Todo>.
      </p>
      <p>
        Roli për të dhënat e rezervimeve (restoranti si kontrollues dhe platforma si përpunues, apo ndryshe): <Todo>përcaktimi ligjor dhe
        marrëveshja me restorantet</Todo>.
      </p>

      <h2>4. Shërbime të jashtme që përdor kodi</h2>
      <div className="om-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Shërbimi</th>
              <th>Kur</th>
              <th>Çfarë merr</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Google Fonts</td><td>Në çdo faqe (shkronjat)</td><td>Adresën IP dhe të dhënat teknike të shfletuesit</td></tr>
            <tr><td>OpenStreetMap (tile-t e hartës)</td><td>Kur shfaqet harta e restorantit</td><td>Adresën IP dhe zonën e hartës</td></tr>
            <tr><td>Google Maps</td><td>Vetëm kur klikoni “Merr udhëzime” / “Hape në hartë”</td><td>Destinacionin; vendndodhjen tuaj s’e dërgojmë ne</td></tr>
            <tr><td>Wolt</td><td>Vetëm kur klikoni “Wolt ↗”</td><td>Faqja hapet te Wolt; porosia bëhet atje</td></tr>
            <tr><td>Cloudinary</td><td>Ruajtja dhe shfaqja e fotove të ngarkuara nga bizneset</td><td>Fotot; adresën IP kur shfaqen</td></tr>
            <tr><td>Resend</td><td>Dërgimi i email-eve (verifikim, rikuperim, rezervime)</td><td>Adresën e marrësit dhe përmbajtjen e email-it</td></tr>
            <tr><td>Google (hyrje)</td><td>Kur një biznes zgjedh “Hyr me Google”</td><td>Të dhënat e hyrjes nga Google</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Hostimi dhe databaza: <Todo>ofruesit e konfirmuar me kontratë (sipas konfigurimit aktual: Vercel dhe Neon), vendndodhja e
        serverëve dhe transferimet jashtë vendit</Todo>.
      </p>

      <h2>5. Sa kohë i ruajmë</h2>
      <p>
        <Todo>afatet e ruajtjes për rezervimet, klientët, llogaritë, regjistrin e auditimit, statistikat dhe çelësat e kufizimit të
        tentativave</Todo>. Shënim: aktualisht platforma nuk ka fshirje automatike me afat për këto të dhëna.
      </p>

      <h2>6. Të drejtat tuaja</h2>
      <p>
        Mund të kërkoni qasje, korrigjim ose fshirje të të dhënave tuaja dhe të kundërshtoni përpunimin, sipas ligjit në fuqi. Kanali
        i kërkesave: <Todo>email/adresa</Todo>. Autoriteti ku mund të ankoheni: <Todo>autoriteti mbikëqyrës përkatës</Todo>.
      </p>

      <h2>7. Ndryshimet</h2>
      <p>Kur kjo politikë ndryshon, përditësojmë datën e versionit në krye të faqes.</p>
    </LegalPage>
  );
}
