"use client";

import { useLang } from "./use-lang";
import type { LinkType } from "@/modules/restaurants/external-links";

export type InfoView = {
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  aboutAl: string | null;
  aboutEn: string | null;
  links: { type: LinkType; url: string }[];
  reserveHref: string | null;
};

function Row({
  icon,
  label,
  sub,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href: string;
  external?: boolean;
}) {
  const ext = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <a className="rprofile-link" href={href} {...ext}>
      <span className="rprofile-link-icon">{icon}</span>
      <span className="rprofile-link-text">
        <span className="rprofile-link-label">{label}</span>
        <span className="rprofile-link-sub">{sub}</span>
      </span>
      <svg className="rprofile-link-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" aria-hidden="true">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </a>
  );
}

export function RestaurantInfo({ info }: { info: InfoView }) {
  const { lang } = useLang();
  const t = (al: string, en: string) => (lang === "al" ? al : en);
  const suffix = lang === "al" ? "Al" : "En";
  const about = info[`about${suffix}` as "aboutAl" | "aboutEn"] ?? null;

  const mapsLink = info.links.find((l) => l.type === "MAPS");
  const instaLink = info.links.find((l) => l.type === "INSTAGRAM");
  const woltLink = info.links.find((l) => l.type === "WOLT");
  const siteLink = info.links.find((l) => l.type === "WEBSITE");

  return (
    <div className="rprofile-body">
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", color: "var(--ink)", marginBottom: 4 }}>
        {t("Informacion", "Information")}
      </h1>
      <p className="rprofile-link-sub" style={{ whiteSpace: "normal", marginBottom: 14 }}>{info.name}</p>

      {about && <div className="rprofile-about">{about}</div>}

      <div className="rprofile-section-title">{t("Kontakti", "Contact")}</div>
      <div className="rprofile-links">
        {info.address && (
          <Row
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>}
            label={t("Adresa", "Address")}
            sub={info.address}
            href={mapsLink ? mapsLink.url : `https://www.google.com/maps/search/${encodeURIComponent(info.address)}`}
            external
          />
        )}
        {info.phone && (
          <Row
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 4h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>}
            label={t("Telefon", "Phone")}
            sub={info.phone}
            href={`tel:${info.phone}`}
          />
        )}
        {info.whatsapp && (
          <Row
            icon={<span aria-hidden="true">💬</span>}
            label="WhatsApp"
            sub={`+${info.whatsapp}`}
            href={`https://wa.me/${info.whatsapp}`}
            external
          />
        )}
      </div>

      {(mapsLink || instaLink || woltLink || siteLink) && (
        <>
          <div className="rprofile-section-title">{t("Lidhje", "Links")}</div>
          <div className="rprofile-links">
            {woltLink && (
              <Row icon={<span aria-hidden="true">🛵</span>} label="Wolt" sub={t("Porosit online", "Order online")} href={woltLink.url} external />
            )}
            {instaLink && (
              <Row
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>}
                label="Instagram"
                sub={t("Na ndiq", "Follow us")}
                href={instaLink.url}
                external
              />
            )}
            {siteLink && (
              <Row
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>}
                label={t("Faqja zyrtare", "Website")}
                sub={t("Vizito faqen", "Visit site")}
                href={siteLink.url}
                external
              />
            )}
          </div>
        </>
      )}

      {info.reserveHref && (
        <>
          <div className="rprofile-section-title">{t("Rezervim", "Reservation")}</div>
          <div className="rprofile-links">
            <a
              className="rprofile-link rprofile-link--reserve"
              href={info.reserveHref}
              {...(info.reserveHref.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            >
              <span className="rprofile-link-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
              </span>
              <span className="rprofile-link-text">
                <span className="rprofile-link-label">{t("Rezervo tavolinë", "Reserve a table")}</span>
                <span className="rprofile-link-sub">{t("Zgjidh datën, orën dhe personat", "Pick date, time and party")}</span>
              </span>
              <svg className="rprofile-link-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
