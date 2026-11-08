import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/public/legal-page";
import { TRIAL_DAYS } from "@/modules/restaurants/provision";
import "@/components/public/om-public.css";

export const metadata: Metadata = {
  title: "Kushtet e përdorimit",
  robots: { index: false, follow: false }, // draft — s'indeksohet para shqyrtimit
};

export default function TermsPage() {
  return (
    <LegalPage title="Kushtet e përdorimit" version="versioni draft i 8 nëntorit 2026">
      <h2>1. Shërbimi</h2>
      <p>
        OnlineMenu.al ofron menu digjitale, profile publike restorantesh, kode QR dhe — kur moduli është aktiv për një restorant —
        rezervime tavolinash. Operatori: <Todo>emri ligjor, NIPT, adresa, kontakti</Todo>.
      </p>

      <h2>2. Për vizitorët</h2>
      <ul>
        <li>Përdorimi i menuve dhe profileve nuk kërkon llogari.</li>
        <li>
          Menuja, çmimet, alergjenët, oraret dhe informacioni i restorantit vendosen nga vetë restoranti. Për pyetje mbi pjatat ose
          alergjenët, konfirmoni me restorantin.
        </li>
        <li>
          Rezervimi bëhet me restorantin përkatës; mund ta anuloni nga lidhja që merrni pas konfirmimit. Ndryshimet e orës ose
          personave bëhen duke kontaktuar restorantin.
        </li>
        <li>Wolt dhe hartat janë shërbime të jashtme me kushtet e tyre; porositë në Wolt nuk bëhen në OnlineMenu.al.</li>
      </ul>

      <h2>3. Për bizneset</h2>
      <ul>
        <li>Llogaria krijohet me email të verifikuar ose me Google. Ruani fjalëkalimin dhe mos e ndani llogarinë.</li>
        <li>Jeni përgjegjës për saktësinë dhe ligjshmërinë e përmbajtjes që publikoni (emri, menuja, çmimet, alergjenët, fotot, lidhjet).</li>
        <li>Llogaria e re fillon me {TRIAL_DAYS} ditë provë. Çmimet, pagesa dhe vazhdimi pas provës: <Todo>kushtet tregtare</Todo>.</li>
        <li>Moduli i rezervimeve aktivizohet veçmas; kur është aktiv, trajtoni të dhënat e mysafirëve vetëm për rezervimin.</li>
        <li>Mund të pezullojmë profile që shkelin këto kushte ose ligjin. <Todo>procedura dhe njoftimi</Todo>.</li>
      </ul>

      <h2>4. Përdorim i ndaluar</h2>
      <p>
        Ndalohet përdorimi për përmbajtje të paligjshme ose mashtruese, tentativat për të anashkaluar sigurinë ose kufizimet e
        tentativave, dhe ndërhyrja në funksionimin e platformës.
      </p>

      <h2>5. Disponueshmëria dhe përgjegjësia</h2>
      <p>
        Synojmë që shërbimi të jetë i disponueshëm, por mund të ketë ndërprerje për mirëmbajtje ose probleme teknike. Kufizimi i
        përgjegjësisë: <Todo>teksti ligjor</Todo>.
      </p>

      <h2>6. Të dhënat personale</h2>
      <p>
        Si i përpunojmë të dhënat: <Link href="/privatesia">Politika e privatësisë</Link> dhe{" "}
        <Link href="/cookies">Politika e cookies</Link>.
      </p>

      <h2>7. Ligji dhe mosmarrëveshjet</h2>
      <p>
        <Todo>ligji i zbatueshëm dhe gjykata kompetente</Todo>.
      </p>

      <h2>8. Ndryshimet</h2>
      <p>Kur kushtet ndryshojnë, përditësojmë datën e versionit në krye të faqes.</p>
    </LegalPage>
  );
}
