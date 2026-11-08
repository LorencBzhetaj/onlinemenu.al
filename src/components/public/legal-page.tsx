import { OmSiteHeader } from "@/components/public/om-site-header";
import { OmSiteFooter } from "@/components/public/om-site-footer";

/** Shënjues për të dhëna që duhen plotësuar nga pronari/juristi (s'shpiken kurrë). */
export function Todo({ children }: { children: React.ReactNode }) {
  return <span className="om-todo">[TË PLOTËSOHET: {children}]</span>;
}

/** Kornizë e përbashkët për faqet ligjore: header, njoftim DRAFT, përmbajtje, fundfaqe. */
export function LegalPage({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-om-white">
      <OmSiteHeader />
      <main className="om-prose">
        <h1>{title}</h1>
        <p className="om-draft" role="note">
          DRAFT për shqyrtim ligjor — {version}. Ky tekst përshkruan vetëm atë që bën sot platforma dhe ka fusha të paplotësuara.
          Nuk duhet publikuar në Production para shqyrtimit.
        </p>
        {children}
      </main>
      <OmSiteFooter />
    </div>
  );
}
