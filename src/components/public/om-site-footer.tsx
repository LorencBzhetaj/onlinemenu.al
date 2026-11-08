import Link from "next/link";

/** Fundfaqja e përbashkët publike: navigimi + faqet ligjore (draft për shqyrtim). */
export function OmSiteFooter() {
  return (
    <footer className="om-site-footer">
      <div className="om-site-footer-inner">
        <nav aria-label="Fundfaqja" className="om-footer-cols">
          <div>
            <p className="om-footer-h">OnlineMenu.al</p>
            <Link href="/">Restorantet</Link>
            <Link href="/si-funksionon">Si funksionon</Link>
            <Link href="/per-bizneset">Për bizneset</Link>
          </div>
          <div>
            <p className="om-footer-h">Ligjore</p>
            <Link href="/kushtet">Kushtet e përdorimit</Link>
            <Link href="/privatesia">Politika e privatësisë</Link>
            <Link href="/cookies">Politika e cookies</Link>
          </div>
        </nav>
        <p className="om-footer-copy">© {new Date().getFullYear()} OnlineMenu.al</p>
      </div>
    </footer>
  );
}
