import Link from "next/link";

/** Shenja e brandit: "OnlineMenu.al" në Aubergine me tri vija Butter (si te mockup-et). */
export function OmLogo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`om-logo om-logo--${size}`}>
      OnlineMenu<span className="om-logo-tld">.al</span>
      <svg className="om-logo-spark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9 3 5M12 6V2M19 9l2-4" />
      </svg>
    </span>
  );
}

type NavKey = "restaurants" | "how" | "business";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "restaurants", href: "/", label: "Restorantet" },
  { key: "how", href: "/si-funksionon", label: "Si funksionon" },
  { key: "business", href: "/per-bizneset", label: "Për bizneset" },
];

/**
 * Header-i publik i OnlineMenu.al. Desktop: Restorantet · Si funksionon · Për bizneset + "Hyr" (dytësor).
 * Telefon: logo + menu kompakte (<details>, pa JS shtesë). Navigimi i profilit mbetet poshtë (PublicTabs).
 */
export function OmSiteHeader({ active, signedIn = false }: { active?: NavKey; signedIn?: boolean }) {
  // I kyçur → "Llogaria ime" në vend të "Hyr" (dalja bëhet te faqja e llogarisë).
  const secondary = signedIn ? { href: "/account", label: "Llogaria ime" } : { href: "/login", label: "Hyr" };
  const links = NAV.map((n) => (
    <Link key={n.key} href={n.href} className={active === n.key ? "is-active" : ""} aria-current={active === n.key ? "page" : undefined}>
      {n.label}
    </Link>
  ));
  return (
    <header className="om-site-header">
      <div className="om-site-header-inner">
        <Link href="/" className="om-site-brand" aria-label="OnlineMenu.al — restorantet">
          {/* Logoja zyrtare (Shefi i Bukës në kutinë rozë) si shenjë e vogël pranë emrit. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-chef-96.png" alt="" width={48} height={38} className="om-logo-mark" />
          <OmLogo />
        </Link>

        <nav className="om-site-nav om-nav-desktop" aria-label="Kryesore">
          {links}
          <Link href={secondary.href} className="om-site-secondary">
            {secondary.label}
          </Link>
        </nav>

        <details className="om-nav-mobile">
          <summary aria-label="Menuja e navigimit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <nav className="om-nav-mobile-panel" aria-label="Kryesore">
            {links}
            <Link href={secondary.href} className="om-site-secondary">
              {secondary.label}
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
