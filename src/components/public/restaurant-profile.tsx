"use client";

import Link from "next/link";
import { getInitials } from "@/lib/branding";
import { useLang } from "./use-lang";
import type { LinkType } from "@/modules/restaurants/external-links";

export type ProfileView = {
  slug: string;
  name: string;
  logoUrl: string | null;
  estYear: number | null;
  taglineAl: string | null;
  taglineEn: string | null;
  subtitleAl: string | null;
  subtitleEn: string | null;
  aboutAl: string | null;
  aboutEn: string | null;
  phone: string | null;
  links: { type: LinkType; url: string }[];
  menuActive: boolean;
  reserveHref: string | null; // jo-null vetëm kur BOOKING aktiv + destinacion funksional
};

function LinkIcon({ type }: { type: LinkType | "PHONE" | "RESERVE" }) {
  switch (type) {
    case "WOLT":
      return <span aria-hidden="true">🛵</span>;
    case "INSTAGRAM":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "MAPS":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "WEBSITE":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
        </svg>
      );
    case "PHONE":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M5 4h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "RESERVE":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
  }
}

function Chevron() {
  return (
    <svg className="rprofile-link-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function RestaurantProfile({ profile }: { profile: ProfileView }) {
  const { lang, setLang } = useLang();
  const t = (al: string, en: string) => (lang === "al" ? al : en);
  const suffix = lang === "al" ? "Al" : "En";

  const tagline = (profile[`tagline${suffix}` as "taglineAl" | "taglineEn"]) ?? null;
  const subtitle = (profile[`subtitle${suffix}` as "subtitleAl" | "subtitleEn"]) ?? null;
  const about = (profile[`about${suffix}` as "aboutAl" | "aboutEn"]) ?? null;

  const linkLabels: Record<LinkType, string> = {
    WOLT: "Wolt",
    INSTAGRAM: "Instagram",
    MAPS: t("Vendndodhja", "Location"),
    WEBSITE: t("Faqja zyrtare", "Website"),
  };
  const linkSubs: Record<LinkType, string> = {
    WOLT: t("Porosit online", "Order online"),
    INSTAGRAM: t("Na ndiq", "Follow us"),
    MAPS: t("Hape në hartë", "Open in maps"),
    WEBSITE: t("Vizito faqen", "Visit site"),
  };

  return (
    <>
      <header className="rprofile-hero">
        <div className="rprofile-lang" role="group" aria-label={t("Zgjidh gjuhën", "Choose language")}>
          <button type="button" className={lang === "al" ? "active" : ""} aria-pressed={lang === "al"} onClick={() => setLang("al")}>
            AL
          </button>
          <button type="button" className={lang === "en" ? "active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </button>
        </div>

        {profile.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="rprofile-crest" src={profile.logoUrl} alt={profile.name} width={84} height={84} />
        ) : (
          <div className="rprofile-crest-fallback">{getInitials(profile.name)}</div>
        )}
        {profile.estYear && <div className="rprofile-est">EST. {profile.estYear}</div>}
        <h1>{profile.name}</h1>
        {tagline && <div className="rprofile-script">{tagline}</div>}
        {subtitle && <div className="rprofile-subtitle">{subtitle}</div>}
      </header>

      <div className="rprofile-body">
        {about && <div className="rprofile-about">{about}</div>}

        {/* Veprimet kryesore: Menu + Informacion (QR hap profilin; menuja hapet prej këtu). */}
        <div className="rprofile-primary">
          <Link href={`/restaurants/${profile.slug}/menu`} className="rprofile-btn rprofile-btn--primary">
            <LinkIcon type="WEBSITE" />
            {t("Menuja", "Menu")}
          </Link>
          <Link href={`/restaurants/${profile.slug}/info`} className="rprofile-btn rprofile-btn--outline">
            {t("Informacion", "Info")}
          </Link>
        </div>

        {!profile.menuActive && (
          <div className="rprofile-notice">
            {t(
              "Menuja dixhitale është përkohësisht joaktive. Kontaktoni restorantin për informacion.",
              "The digital menu is temporarily inactive. Please contact the restaurant."
            )}
          </div>
        )}

        <div className="rprofile-links">
          {/* Rezervimi: vetëm kur ka modul BOOKING + destinacion funksional (jo booking live i Gjeçaj). */}
          {profile.reserveHref && (
            <a className="rprofile-link rprofile-link--reserve" href={profile.reserveHref} target="_blank" rel="noopener noreferrer">
              <span className="rprofile-link-icon"><LinkIcon type="RESERVE" /></span>
              <span className="rprofile-link-text">
                <span className="rprofile-link-label">{t("Rezervo tavolinë", "Reserve a table")}</span>
                <span className="rprofile-link-sub">{t("Na shkruaj për rezervim", "Message us to book")}</span>
              </span>
              <Chevron />
            </a>
          )}

          {profile.links.map((l) => (
            <a key={l.type} className="rprofile-link" href={l.url} target="_blank" rel="noopener noreferrer">
              <span className="rprofile-link-icon"><LinkIcon type={l.type} /></span>
              <span className="rprofile-link-text">
                <span className="rprofile-link-label">{linkLabels[l.type]}</span>
                <span className="rprofile-link-sub">{linkSubs[l.type]}</span>
              </span>
              <Chevron />
            </a>
          ))}

          {profile.phone && (
            <a className="rprofile-link" href={`tel:${profile.phone}`}>
              <span className="rprofile-link-icon"><LinkIcon type="PHONE" /></span>
              <span className="rprofile-link-text">
                <span className="rprofile-link-label">{t("Telefon", "Phone")}</span>
                <span className="rprofile-link-sub">{profile.phone}</span>
              </span>
              <Chevron />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
