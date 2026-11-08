import { SITE_URL, analyticsEnabled } from "@/lib/site-config";
import { ConsentAndGtm } from "@/components/analytics/consent-gtm";
import "./coming-soon.css";

// Faqe statike: hapet me 200 pa lidhje me databazën.
export const dynamic = "force-static";

// Të dhëna të strukturuara vetëm me fakte të dukshme/verifikuara: emri, URL-ja dhe logoja.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "OnlineMenu.al",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/logo-chef.webp`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "OnlineMenu.al",
      url: `${SITE_URL}/`,
      inLanguage: "sq",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function ComingSoonPage() {
  return (
    <main className="cs">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Shfletuesi shkarkon vetëm imazhin që i përshtatet ekranit (portret → mobile, peizazh → desktop). */}
      <picture className="cs-bg">
        <source media="(orientation: portrait)" srcSet="/coming-soon/mobile.webp" width={941} height={1672} />
        <img src="/coming-soon/desktop.webp" alt="" width={1672} height={941} fetchPriority="high" decoding="async" />
      </picture>

      <div className="cs-content">
        <p className="cs-brand">
          OnlineMenu<span>.al</span>
        </p>
        <h1 className="cs-title">Së shpejti</h1>
        <p className="cs-en" lang="en">
          Coming soon
        </p>
        <span className="cs-rule" aria-hidden="true" />
        <p className="cs-tagline">Menu digjitale dhe rezervime tavolinash.</p>
        <p className="cs-about">
          OnlineMenu.al po përgatit një platformë për të zbuluar restorante, për të parë menutë digjitale dhe për të rezervuar tavolina
          te bizneset që e ofrojnë.
        </p>
      </div>

      {analyticsEnabled() && <ConsentAndGtm />}
    </main>
  );
}
