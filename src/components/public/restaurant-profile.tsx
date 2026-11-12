"use client";

import Link from "next/link";
import { getInitials } from "@/lib/branding";
import { menuHref } from "@/lib/safe-return";
import { useLang } from "./use-lang";
import { AnalyticsBeacon, sendEvent } from "./analytics-beacon";
import { RestaurantLocation } from "./restaurant-location";
import type { LinkType } from "@/modules/restaurants/external-links";

export type ProfileView = {
  slug: string;
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  estYear: number | null;
  taglineAl: string | null;
  taglineEn: string | null;
  subtitleAl: string | null;
  subtitleEn: string | null;
  aboutAl: string | null;
  aboutEn: string | null;
  phone: string | null;
  city: string | null;
  cuisine: string | null;
  address: string | null;
  links: { type: LinkType; url: string }[];
  menuActive: boolean;
  reserveHref: string | null; // jo-null vetëm kur BOOKING aktiv + destinacion funksional
  location: {
    coords: { lat: number; lng: number } | null;
    mapsLink: string | null;
    directionsHref: string | null;
    routingUrl: string | null;
  };
};

const Icon = {
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M5 4h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  ),
};

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

  const tagline = profile[`tagline${suffix}` as "taglineAl" | "taglineEn"] ?? null;
  const about = profile[`about${suffix}` as "aboutAl" | "aboutEn"] ?? null;
  const meta = [profile.cuisine, profile.city].filter(Boolean).join(" · ");

  const wolt = profile.links.find((l) => l.type === "WOLT") ?? null;
  const instagram = profile.links.find((l) => l.type === "INSTAGRAM") ?? null;
  const website = profile.links.find((l) => l.type === "WEBSITE") ?? null;
  const mapsLink = profile.location.mapsLink;
  const hasLocation = Boolean(profile.address || profile.location.coords || mapsLink);
  // Pa përmbajtje kryesore: s'lëmë kolonë bosh në desktop (karta e rezervimit zë vendin e saj).
  const hasMainContent = Boolean(about || instagram || website || profile.phone || hasLocation);
  const reserveInternal = profile.reserveHref?.startsWith("/") ?? false;
  const reserveExt = profile.reserveHref && !reserveInternal ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <>
      <AnalyticsBeacon slug={profile.slug} type="profile_view" />

      {/* ===== COVER + IDENTITETI ===== */}
      <header className="om-cover">
        {profile.coverUrl ? (
          // Foto kopertine opsionale (dekorative; emri i restorantit vjen më poshtë si tekst).
          // eslint-disable-next-line @next/next/no-img-element
          <img className="om-cover-band om-cover-photo" src={profile.coverUrl} alt="" decoding="async" fetchPriority="high" />
        ) : (
          <div className="om-cover-band" aria-hidden="true" />
        )}
        <div className="rprofile-lang om-lang" role="group" aria-label={t("Zgjidh gjuhën", "Choose language")}>
          <button type="button" className={lang === "al" ? "active" : ""} aria-pressed={lang === "al"} onClick={() => setLang("al")}>
            AL
          </button>
          <button type="button" className={lang === "en" ? "active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </button>
        </div>

        <div className="om-identity">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="om-crest" src={profile.logoUrl} alt={`Logo e ${profile.name}`} width={104} height={104} />
          ) : (
            <div className="om-crest om-crest--initials" aria-hidden="true">
              {getInitials(profile.name)}
            </div>
          )}
          <div className="om-identity-text">
            <h1 className="om-name">{profile.name}</h1>
            {meta && <p className="om-meta">{meta}</p>}
            {(tagline || profile.estYear) && (
              <p className="om-tagline">
                {tagline}
                {tagline && profile.estYear ? " · " : ""}
                {profile.estYear ? `${t("që nga", "since")} ${profile.estYear}` : ""}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="om-profile">
        {/* ===== VEPRIMET: Menuja · Rezervo · Wolt ===== */}
        <div className="om-actions">
          <Link href={menuHref(profile.slug, `/restaurants/${profile.slug}`)} className="om-btn om-btn--menu">
            {Icon.menu}
            {t("Menuja", "Menu")}
          </Link>
          {profile.reserveHref && (
            <a href={profile.reserveHref} className="om-btn om-btn--reserve" {...reserveExt}>
              {Icon.calendar}
              {t("Rezervo", "Reserve")}
            </a>
          )}
          {wolt && (
            <a
              href={wolt.url}
              className="om-btn om-btn--wolt"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sendEvent(profile.slug, "wolt_click")}
              aria-label={t("Wolt (hapet në faqe të jashtme)", "Wolt (opens an external site)")}
            >
              Wolt <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>

        {!profile.menuActive && (
          <div className="rprofile-notice">
            {t(
              "Menuja dixhitale është përkohësisht joaktive. Kontaktoni restorantin për informacion.",
              "The digital menu is temporarily inactive. Please contact the restaurant."
            )}
          </div>
        )}

        <div className={`om-profile-grid${hasMainContent ? "" : " om-profile-grid--solo"}`}>
          {hasMainContent && <div className="om-profile-main">
            {about && (
              <section className="om-card om-about" aria-label={t("Rreth restorantit", "About the restaurant")}>
                <p>{about}</p>
              </section>
            )}

            {(instagram || website || profile.phone) && (
              <section aria-labelledby="om-contact-title">
                <h2 id="om-contact-title" className="om-section-h">
                  {t("Kontakti", "Contact")}
                </h2>
                <div className="rprofile-links">
                  {profile.phone && (
                    <a className="rprofile-link" href={`tel:${profile.phone}`}>
                      <span className="rprofile-link-icon">{Icon.phone}</span>
                      <span className="rprofile-link-text">
                        <span className="rprofile-link-label">{t("Telefon", "Phone")}</span>
                        <span className="rprofile-link-sub">{profile.phone}</span>
                      </span>
                      <Chevron />
                    </a>
                  )}
                  {instagram && (
                    <a className="rprofile-link" href={instagram.url} target="_blank" rel="noopener noreferrer">
                      <span className="rprofile-link-icon">{Icon.instagram}</span>
                      <span className="rprofile-link-text">
                        <span className="rprofile-link-label">Instagram</span>
                        <span className="rprofile-link-sub">{t("Na ndiq", "Follow us")}</span>
                      </span>
                      <Chevron />
                    </a>
                  )}
                  {website && (
                    <a className="rprofile-link" href={website.url} target="_blank" rel="noopener noreferrer">
                      <span className="rprofile-link-icon">{Icon.website}</span>
                      <span className="rprofile-link-text">
                        <span className="rprofile-link-label">{t("Faqja zyrtare", "Website")}</span>
                        <span className="rprofile-link-sub">{t("Vizito faqen", "Visit site")}</span>
                      </span>
                      <Chevron />
                    </a>
                  )}
                </div>
              </section>
            )}

            {hasLocation && (
              <RestaurantLocation
                name={profile.name}
                address={profile.address}
                coords={profile.location.coords}
                mapsLink={mapsLink}
                directionsHref={profile.location.directionsHref}
                routingUrl={profile.location.routingUrl}
              />
            )}
          </div>}

          {/* Desktop: hapësirë anësore për rezervimin (në telefon butoni Rezervo është sipër). */}
          {profile.reserveHref && (
            <aside className="om-profile-side" aria-label={t("Rezervo tavolinë", "Reserve a table")}>
              <div className="om-card om-reserve-card">
                <span className="om-reserve-icon">{Icon.calendar}</span>
                <h2>{t("Rezervo tavolinë", "Reserve a table")}</h2>
                <p>{t("Zgjidh datën, numrin e personave dhe orën e lirë.", "Pick a date, party size and a free time.")}</p>
                <a href={profile.reserveHref} className="om-btn om-btn--reserve om-btn--block" {...reserveExt}>
                  {t("Shiko oraret", "See times")}
                </a>
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
