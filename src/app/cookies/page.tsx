import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/public/legal-page";
import "@/components/public/om-public.css";

export const metadata: Metadata = {
  title: "Politika e cookies",
  robots: { index: false, follow: false }, // draft — s'indeksohet para shqyrtimit
};

export default function CookiesPage() {
  return (
    <LegalPage title="Politika e cookies" version="versioni draft i 8 nëntorit 2026">
      <p>
        Këtu listojmë cookies dhe ruajtjen në shfletues që përdor sot kodi i OnlineMenu.al. Nuk përdorim cookies reklamash apo
        gjurmimi nga palë të treta.
      </p>

      <h2>1. Cookies të sistemit të hyrjes</h2>
      <p>
        Përdoren për hyrjen e bizneseve në panel dhe për mbrojtje nga kërkesat e falsifikuara. Sesioni vendoset vetëm pas hyrjes.
        Aktualisht, <code>csrf-token</code> dhe <code>callback-url</code> vendosen edhe kur vizitori hap faqet publike, sepse sistemi i
        hyrjes kontrollon sesionin në çdo faqe. <Todo>vendimi: kufizimi i këtyre cookies vetëm te hyrja/paneli, ose klasifikimi i tyre
        si të domosdoshme pas shqyrtimit</Todo>.
      </p>
      <div className="om-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Emri</th>
              <th>Qëllimi</th>
              <th>Kohëzgjatja</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>next-auth.session-token</code> (në HTTPS: <code>__Secure-</code>)</td><td>Sesioni i hyrjes në panel</td><td>Sesioni i hyrjes <Todo>afati i konfirmuar</Todo></td></tr>
            <tr><td><code>next-auth.csrf-token</code> (në HTTPS: <code>__Host-</code>)</td><td>Mbrojtje e formularit të hyrjes</td><td>Sesion i shfletuesit</td></tr>
            <tr><td><code>next-auth.callback-url</code> (në HTTPS: <code>__Secure-</code>)</td><td>Kthimi te faqja pas hyrjes</td><td>Sesion i shfletuesit</td></tr>
            <tr><td><code>next-auth.state</code>, <code>next-auth.pkce.code_verifier</code></td><td>Vetëm gjatë “Hyr me Google”</td><td>Disa minuta</td></tr>
          </tbody>
        </table>
      </div>

      <h2>2. Ruajtje në pajisje (localStorage)</h2>
      <div className="om-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Çelësi</th>
              <th>Qëllimi</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>menu-lang</code></td><td>Mban gjuhën e zgjedhur (shqip/anglisht) në profil dhe menu</td></tr>
            <tr><td><code>nextauth.message</code></td><td>Përdoret nga sistemi i hyrjes për të sinkronizuar sesionin mes skedave</td></tr>
          </tbody>
        </table>
      </div>

      <h2>3. Statistikat</h2>
      <p>
        Statistikat për restorantet (shikime profili/menuje, klikime pjatash dhe Wolt) ruhen në serverin tonë pa cookies dhe pa të
        dhëna personale. Shih <Link href="/privatesia">Politikën e privatësisë</Link>.
      </p>

      <h2>4. Shërbime të jashtme</h2>
      <p>
        Shkronjat ngarkohen nga Google Fonts dhe harta nga OpenStreetMap; këto shërbime marrin adresën IP kur ngarkohen, por kodi
        ynë nuk vendos cookies për to. Lidhjet drejt Wolt dhe Google Maps hapen vetëm kur klikoni.
      </p>

      <h2>5. Si t’i menaxhoni</h2>
      <p>
        Mund t’i fshini cookies dhe ruajtjen lokale nga cilësimet e shfletuesit. Pa cookies e domosdoshme nuk mund të hyni në panel;
        menutë dhe profilet publike funksionojnë njësoj.
      </p>
      <p>
        Kontakt për pyetje: <Todo>email-i i kontaktit</Todo>.
      </p>
    </LegalPage>
  );
}
