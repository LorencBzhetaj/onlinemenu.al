"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryIcon } from "@/lib/menu-icons";
import { getInitials } from "@/lib/branding";

// ── Tipat e të dhënave publike (vetëm artikuj të dukshëm vijnë nga serveri) ──
export type PubItem = {
  id: string;
  nameAl: string;
  nameEn: string;
  descAl: string | null;
  descEn: string | null;
  price: number;
  imageUrl: string | null;
};

export type MenuPhotoStyle = "large" | "thumbnail" | "none";
export type PubSubcat = { id: string; nameAl: string; nameEn: string; items: PubItem[] };
export type PubCategory = {
  id: string;
  nameAl: string;
  nameEn: string;
  icon: string | null;
  items: PubItem[];
  subcategories: PubSubcat[];
};
export type PubCourse = { titleAl: string; titleEn: string; descAl: string; descEn: string };
export type PubTasting = {
  id: string;
  name: string;
  price: number;
  guestCount: number;
  courses: PubCourse[];
};
export type PubRestaurant = {
  name: string;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  estYear: number | null;
  taglineAl: string | null;
  taglineEn: string | null;
  subtitleAl: string | null;
  subtitleEn: string | null;
};

type Lang = "al" | "en";
const STORAGE_KEY = "menu-lang";

/** Gjuha: default 'al' (SSR-safe), pastaj sinkronizohet me localStorage. */
function useLang() {
  const [lang, setLang] = useState<Lang>("al");
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "al" || s === "en") setLang(s);
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === "al" ? "sq" : "en";
  }, [lang]);
  return { lang, setLang };
}

export function PublicMenu({
  restaurant,
  categories,
  tastingMenus,
  photoStyle,
}: {
  restaurant: PubRestaurant;
  categories: PubCategory[];
  tastingMenus: PubTasting[];
  photoStyle: MenuPhotoStyle;
}) {
  const { lang, setLang } = useLang();
  const [mode, setMode] = useState<"main" | "tasting">("main");
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");

  // Vetëm gjuha e zgjedhur rendon kurdoherë (React conditional, jo CSS toggle).
  const t = (al: string, en: string) => (lang === "al" ? al : en);
  const suffix = lang === "al" ? "Al" : "En";

  const active = useMemo(
    () => categories.find((c) => c.id === activeCat) ?? categories[0],
    [categories, activeCat]
  );

  const hasTasting = tastingMenus.length > 0;

  return (
    <>
      {/* ===== HEADER ===== */}
      <header className="qm-header">
        <div className="qm-brand">
          {restaurant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="qm-crest" src={restaurant.logoUrl} alt={restaurant.name} width={34} height={34} />
          ) : (
            <div className="qm-crest-fallback" style={{ width: 34, height: 34, fontSize: 13 }}>
              {getInitials(restaurant.name)}
            </div>
          )}
          <div>
            <div className="qm-brand-name">{restaurant.name}</div>
            <span className="qm-brand-sub">
              {t("RESTORANT", "RESTAURANT")}
              {restaurant.estYear ? ` · EST. ${restaurant.estYear}` : ""}
            </span>
          </div>
        </div>

        <div className="qm-lang-toggle" role="group" aria-label={t("Zgjidh gjuhën", "Choose language")}>
          <button type="button" className={lang === "al" ? "active" : ""} aria-pressed={lang === "al"} onClick={() => setLang("al")}>
            AL
          </button>
          <button type="button" className={lang === "en" ? "active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </button>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="qm-hero">
        {restaurant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="qm-hero-crest" src={restaurant.logoUrl} alt={restaurant.name} width={78} height={78} />
        ) : (
          <div className="qm-hero-crest-fallback">{getInitials(restaurant.name)}</div>
        )}

        {restaurant.estYear && <div className="qm-hero-est">EST. {restaurant.estYear}</div>}
        <h1>{restaurant.name}</h1>
        <div className="qm-hero-divider" />
        {/* Fallback per-gjuhë: shfaq vetëm nëse gjuha AKTIVE e ka vlerën (jo "ndonjëra"). */}
        {restaurant[`tagline${suffix}`] && (
          <div className="qm-hero-script">{restaurant[`tagline${suffix}`]}</div>
        )}
        {restaurant[`subtitle${suffix}`] && (
          <div className="qm-hero-tagline">{restaurant[`subtitle${suffix}`]}</div>
        )}

        {/* Toggle Main / Tasting (vetëm nëse ka menu degustuese) */}
        {hasTasting && (
          <div className="qm-menu-toggle">
            <button type="button" className={mode === "main" ? "active" : ""} aria-pressed={mode === "main"} onClick={() => setMode("main")}>
              {t("MENU KRYESORE", "MAIN MENU")}
              <span className="qm-toggle-sub">{t("Antipasta, sallata, pjata & pije", "Starters, salads, mains & drinks")}</span>
            </button>
            <button type="button" className={mode === "tasting" ? "active" : ""} aria-pressed={mode === "tasting"} onClick={() => setMode("tasting")}>
              {t("MENU DEGUSTUESE", "TASTING MENU")}
              <span className="qm-toggle-sub">{t("Menu fikse, për 2 persona", "Fixed menu, for 2 people")}</span>
            </button>
          </div>
        )}
      </section>

      {/* ===== PËRMBAJTJA ===== */}
      <main>
        {mode === "main" || !hasTasting ? (
          <>
            <div className="qm-section-heading">
              <div className="qm-section-eyebrow">{t("MENUJA", "THE MENU")}</div>
              <h2 className="qm-section-title">{t("Zbuloni Shijet Tona", "Discover Our Flavours")}</h2>
            </div>

            {categories.length > 1 && (
              <div className="qm-tabs-wrap">
                <div className="qm-tabs" role="tablist" aria-label={t("Kategoritë", "Categories")}>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={cat.id === active?.id}
                      className={`qm-tab ${cat.id === active?.id ? "active" : ""}`}
                      onClick={() => setActiveCat(cat.id)}
                    >
                      <CategoryIcon icon={cat.icon} className="" />
                      <span>{cat[`name${suffix}`]}</span>
                    </button>
                  ))}
                </div>
                <div className="qm-fade-right" aria-hidden="true" />
              </div>
            )}

            {active && (
              <>
                {/* Artikuj direkt nën kategori -> karta */}
                {active.items.length > 0 && (
                  <div className="qm-items">
                    {active.items.map((item) => (
                      <MenuCard key={item.id} item={item} suffix={suffix} photoStyle={photoStyle} />
                    ))}
                  </div>
                )}

                {/* Nën-kategoritë -> layout 2-kolonësh */}
                {active.subcategories.length > 0 && (
                  <div className="qm-subcats-wrap">
                    {chunkPairs(active.subcategories).map((pair, i) => (
                      <div key={i} className={`qm-subcat-pair ${pair.length === 2 ? "two-col" : ""}`}>
                        {pair.map((sub) => (
                          <div className="qm-subcat-col" key={sub.id}>
                            <div className="qm-subcat-title">{sub[`name${suffix}`]}</div>
                            {sub.items.map((item) => (
                              <div className="qm-item-row" key={item.id}>
                                <div className="qm-item-row-top">
                                  <span className="qm-item-name">{item[`name${suffix}`]}</span>
                                  <span className="qm-item-price">{item.price}</span>
                                </div>
                                {item[`desc${suffix}`] && <p className="qm-item-desc-sm">{item[`desc${suffix}`]}</p>}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="qm-section-heading">
              <div className="qm-section-eyebrow">{t("DEGUSTIM", "TASTING")}</div>
              <h2 className="qm-section-title">{t("Sofra e Malësisë", "The Highland Table")}</h2>
            </div>
            <div className="qm-tasting-wrap">
              {tastingMenus.map((menu) => (
                <article className="qm-tasting-card" key={menu.id}>
                  <div className="qm-tasting-name">{menu.name}</div>
                  <div className="qm-tasting-meta">
                    {t(`MENU DEGUSTUESE · PËR ${menu.guestCount} PERSONA`, `TASTING MENU · FOR ${menu.guestCount} PEOPLE`)}
                  </div>
                  <div className="qm-tasting-price">
                    {menu.price} <span>LEK</span>
                  </div>
                  {menu.courses.map((course, i) => (
                    <div className="qm-tasting-course" key={i}>
                      <h4>{course[`title${suffix}`]}</h4>
                      <p>{course[`desc${suffix}`]}</p>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <Footer restaurant={restaurant} t={t} />
    </>
  );
}

function Footer({
  restaurant,
  t,
}: {
  restaurant: PubRestaurant;
  t: (al: string, en: string) => string;
}) {
  const waDigits = restaurant.whatsapp?.replace(/[^0-9]/g, "") ?? "";
  const reserveMsg = t(
    `Përshëndetje! Dua të rezervoj një tavolinë te ${restaurant.name}.`,
    `Hello! I'd like to reserve a table at ${restaurant.name}.`
  );
  const reserveHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(reserveMsg)}`
    : restaurant.phone
      ? `tel:${restaurant.phone}`
      : null;

  return (
    <footer className="qm-footer">
      <div className="qm-footer-note">
        {t(
          "✓ Produktet tona janë të kultivuara dhe të korrura në vend",
          "✓ Our products are locally grown and harvested"
        )}
      </div>
      <div className="qm-script">{t("Shijoni gatimet tona", "Enjoy our dishes")}</div>
      {(restaurant.address || restaurant.phone) && (
        <div className="qm-contact">
          {restaurant.address && <span>{restaurant.address}</span>}
          {restaurant.address && restaurant.phone && " · "}
          {restaurant.phone && <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>}
        </div>
      )}

      {reserveHref && (
        <a className="qm-reserve-btn" href={reserveHref} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
          {t("REZERVO TAVOLINË", "RESERVE A TABLE")}
        </a>
      )}
    </footer>
  );
}

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

/** Kartë e artikullit — rendon foto sipas stilit të zgjedhur nga pronari. */
function MenuCard({
  item,
  suffix,
  photoStyle,
}: {
  item: PubItem;
  suffix: "Al" | "En";
  photoStyle: MenuPhotoStyle;
}) {
  const name = item[`name${suffix}`];
  const desc = item[`desc${suffix}`];
  const hasImage = Boolean(item.imageUrl);
  const showThumb = photoStyle === "thumbnail" && hasImage;
  const showLarge = photoStyle === "large" && hasImage;

  const priceBadge = (
    <div className="qm-price-badge">
      <span className="qm-num">{item.price}</span>
      <span className="qm-cur">LEK</span>
    </div>
  );

  if (showThumb) {
    return (
      <article className="qm-card">
        <div className="qm-card-thumbrow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qm-card-thumb" src={item.imageUrl!} alt="" />
          <div className="qm-card-thumbmain">
            <div className="qm-card-top">
              <h3 className="qm-card-name">{name}</h3>
              {priceBadge}
            </div>
            <div className="qm-card-rule" />
            {desc && <p className="qm-card-desc">{desc}</p>}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`qm-card ${showLarge ? "qm-card--photo" : ""}`}>
      {showLarge && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="qm-card-photo" src={item.imageUrl!} alt="" />
      )}
      <div className="qm-card-top">
        <h3 className="qm-card-name">{name}</h3>
        {priceBadge}
      </div>
      <div className="qm-card-rule" />
      {desc && <p className="qm-card-desc">{desc}</p>}
    </article>
  );
}
