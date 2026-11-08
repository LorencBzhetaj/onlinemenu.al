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

/**
 * Header-i publik i OnlineMenu.al (Zbulo, profil, rezervim). Në desktop navigimi është sipër;
 * në telefon mbetet kompakt (logo + Zbulo), navigimi i profilit është poshtë (PublicTabs).
 */
export function OmSiteHeader({ active }: { active?: "discover" | "restaurants" }) {
  return (
    <header className="om-site-header">
      <div className="om-site-header-inner">
        <Link href="/" className="om-site-brand" aria-label="OnlineMenu.al — kryefaqja">
          <OmLogo />
        </Link>
        <nav className="om-site-nav" aria-label="Kryesore">
          <Link href="/" className={active === "discover" ? "is-active" : ""} aria-current={active === "discover" ? "page" : undefined}>
            Zbulo
          </Link>
          <Link href="/restaurants" className={`om-hide-sm ${active === "restaurants" ? "is-active" : ""}`} aria-current={active === "restaurants" ? "page" : undefined}>
            Restorantet
          </Link>
          <Link href="/register" className="om-site-cta om-hide-sm">
            Për restorantet
          </Link>
        </nav>
      </div>
    </header>
  );
}
