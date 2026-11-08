"use client";

import { useMemo, useState } from "react";
import { CategoryIcon } from "@/lib/menu-icons";
import { getInitials } from "@/lib/branding";
import { useLang } from "./use-lang";
import { sendEvent } from "./analytics-beacon";

// ── Tipat e të dhënave publike (vetëm artikuj të dukshëm vijnë nga serveri) ──
export type PubItem = {
  id: string;
  nameAl: string;
  nameEn: string;
  descAl: string | null;
  descEn: string | null;
  price: number;
  imageUrl: string | null;
  isChefPick: boolean;
  isAvailable: boolean;
  allergenIds: string[];
};

export type MenuPhotoStyle = "large" | "thumbnail" | "none";
export type PubAllergen = { id: string; nameAl: string; nameEn: string; icon: string | null };
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
  estYear: number | null;
};

type Suffix = "Al" | "En";

export function PublicMenu({
  restaurant,
  categories,
  tastingMenus,
  allergens,
  photoStyle,
  slug,
  back,
}: {
  restaurant: PubRestaurant;
  categories: PubCategory[];
  tastingMenus: PubTasting[];
  allergens: PubAllergen[];
  photoStyle: MenuPhotoStyle;
  slug?: string;
  /** Kthimi: te katalogu/profili (from i validuar) ose "Te restoranti" për link direkt. */
  back?: { href: string; label: string };
}) {
  const { lang, setLang } = useLang();
  // item_view: klikim real mbi një pjatë (analytics tenant-scoped, pa PII).
  const onItemView = slug ? (id: string) => sendEvent(slug, "item_view", id) : undefined;
  const [mode, setMode] = useState<"main" | "tasting">("main");
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const t = (al: string, en: string) => (lang === "al" ? al : en);
  const suffix: Suffix = lang === "al" ? "Al" : "En";

  const allergenMap = useMemo(() => {
    const m = new Map<string, PubAllergen>();
    allergens.forEach((a) => m.set(a.id, a));
    return m;
  }, [allergens]);

  const active = useMemo(
    () => categories.find((c) => c.id === activeCat) ?? categories[0],
    [categories, activeCat]
  );

  // Kërkimi i pjatave: emër/përshkrim në gjuhën aktive + emri i kategorisë. Rezultate të sheshta.
  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    const out: { item: PubItem; catName: string }[] = [];
    const match = (i: PubItem) =>
      (i[`name${suffix}`] ?? "").toLowerCase().includes(q) ||
      (i[`desc${suffix}`] ?? "").toLowerCase().includes(q);
    for (const c of categories) {
      const catName = c[`name${suffix}`];
      c.items.forEach((i) => match(i) && out.push({ item: i, catName }));
      c.subcategories.forEach((s) =>
        s.items.forEach((i) => match(i) && out.push({ item: i, catName: `${catName} · ${s[`name${suffix}`]}` }))
      );
    }
    return out;
  }, [q, categories, suffix]);

  const hasTasting = tastingMenus.length > 0;
  const searching = q.length > 0;

  return (
    <>
      {/* ===== HEADER ===== */}
      <header className="qm-header">
        {back && (
          <a className="qm-back" href={back.href}>
            <span aria-hidden="true">←</span> {back.label}
          </a>
        )}
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
              {t("MENUJA", "MENU")}
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

      {/* ===== KËRKIMI ===== */}
      <div className="qm-search-wrap">
        <div className="qm-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Kërko pjatë…", "Search a dish…")}
            aria-label={t("Kërko pjatë", "Search a dish")}
          />
          {query && (
            <button type="button" className="qm-search-clear" onClick={() => setQuery("")} aria-label={t("Pastro", "Clear")}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* ===== PËRMBAJTJA ===== */}
      <main>
        {searching ? (
          <SearchResults results={searchResults} suffix={suffix} t={t} allergenMap={allergenMap} photoStyle={photoStyle} onItemView={onItemView} />
        ) : mode === "main" || !hasTasting ? (
          <>
            <div className="qm-section-heading">
              {/* Ilustrimi i menusë (dekor): vetëm te titulli, kurrë mbi foto, çmime apo përshkrime. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="om-menu-art" src="/brand/menu-chef-240.png" alt="" width={120} height={80} loading="lazy" decoding="async" />
              <div className="qm-section-eyebrow">{t("MENUJA", "THE MENU")}</div>
              <h2 className="qm-section-title">{t("Zbuloni Shijet Tona", "Discover Our Flavours")}</h2>
            </div>

            {hasTasting && (
              <div className="qm-menu-toggle">
                <button type="button" className={mode === "main" ? "active" : ""} aria-pressed={mode === "main"} onClick={() => setMode("main")}>
                  {t("MENU KRYESORE", "MAIN MENU")}
                </button>
                <button type="button" className={mode === "tasting" ? "active" : ""} aria-pressed={mode === "tasting"} onClick={() => setMode("tasting")}>
                  {t("MENU DEGUSTUESE", "TASTING MENU")}
                </button>
              </div>
            )}

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
                {active.items.length > 0 && (
                  <div className="qm-items">
                    {active.items.map((item) => (
                      <MenuCard key={item.id} item={item} suffix={suffix} photoStyle={photoStyle} allergenMap={allergenMap} t={t} onItemView={onItemView} />
                    ))}
                  </div>
                )}

                {active.subcategories.length > 0 && (
                  <div className="qm-subcats-wrap">
                    {chunkPairs(active.subcategories).map((pair, i) => (
                      <div key={i} className={`qm-subcat-pair ${pair.length === 2 ? "two-col" : ""}`}>
                        {pair.map((sub) => (
                          <div className="qm-subcat-col" key={sub.id}>
                            <div className="qm-subcat-title">{sub[`name${suffix}`]}</div>
                            {sub.items.map((item) => (
                              <ItemRow key={item.id} item={item} suffix={suffix} allergenMap={allergenMap} t={t} onItemView={onItemView} />
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
              <h2 className="qm-section-title">{t("Menu Degustuese", "Tasting Menus")}</h2>
            </div>
            <div className="qm-tasting-wrap">
              {tastingMenus.map((menu) => (
                <article className="qm-tasting-card" key={menu.id}>
                  <div className="qm-tasting-name">{menu.name}</div>
                  <div className="qm-tasting-meta">
                    {t(`MENU DEGUSTUESE · PËR ${menu.guestCount} PERSONA`, `TASTING MENU · FOR ${menu.guestCount} PEOPLE`)}
                  </div>
                  <div className="qm-tasting-price">
                    {menu.price} <span>ALL</span>
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

        {/* Legjenda e alergjenëve */}
        {allergens.length > 0 && !searching && (
          <div className="qm-allergen-legend">
            <div className="qm-allergen-legend-title">{t("Alergjenët", "Allergens")}</div>
            <div className="qm-allergen-legend-list">
              {allergens.map((a) => (
                <span key={a.id} className="qm-allergen-chip">
                  {a.icon ? `${a.icon} ` : ""}
                  {a[`name${suffix}` as "nameAl" | "nameEn"]}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function SearchResults({
  results,
  suffix,
  t,
  allergenMap,
  photoStyle,
  onItemView,
}: {
  results: { item: PubItem; catName: string }[];
  suffix: Suffix;
  t: (al: string, en: string) => string;
  allergenMap: Map<string, PubAllergen>;
  photoStyle: MenuPhotoStyle;
  onItemView?: (id: string) => void;
}) {
  return (
    <>
      <div className="qm-section-heading">
        <div className="qm-section-eyebrow">{t("KËRKIMI", "SEARCH")}</div>
        <h2 className="qm-section-title">
          {results.length} {t("rezultate", "results")}
        </h2>
      </div>
      {results.length === 0 ? (
        <p className="qm-search-empty">{t("Asnjë pjatë nuk përputhet.", "No dish matches.")}</p>
      ) : (
        <div className="qm-items">
          {results.map(({ item, catName }) => (
            <div key={item.id}>
              <div className="qm-search-cat">{catName}</div>
              <MenuCard item={item} suffix={suffix} photoStyle={photoStyle} allergenMap={allergenMap} t={t} onItemView={onItemView} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AllergenTags({
  ids,
  allergenMap,
  suffix,
}: {
  ids: string[];
  allergenMap: Map<string, PubAllergen>;
  suffix: Suffix;
}) {
  const list = ids.map((id) => allergenMap.get(id)).filter(Boolean) as PubAllergen[];
  if (list.length === 0) return null;
  return (
    <div className="qm-item-allergens">
      {list.map((a) => (
        <span key={a.id} className="qm-allergen-chip">
          {a.icon ? `${a.icon} ` : ""}
          {a[`name${suffix}` as "nameAl" | "nameEn"]}
        </span>
      ))}
    </div>
  );
}

function UnavailableBadge({ t }: { t: (al: string, en: string) => string }) {
  return <span className="qm-unavail">{t("Përkohësisht i padisponueshëm", "Temporarily unavailable")}</span>;
}

function ItemRow({
  item,
  suffix,
  allergenMap,
  t,
  onItemView,
}: {
  item: PubItem;
  suffix: Suffix;
  allergenMap: Map<string, PubAllergen>;
  t: (al: string, en: string) => string;
  onItemView?: (id: string) => void;
}) {
  return (
    <div className={`qm-item-row ${item.isAvailable ? "" : "is-unavailable"}`} onClick={onItemView ? () => onItemView(item.id) : undefined}>
      <div className="qm-item-row-top">
        <span className="qm-item-name">
          {item.isChefPick && <span className="qm-chef" title={t("Rekomandim i Shefit", "Chef's pick")}>★</span>}
          {item[`name${suffix}`]}
        </span>
        <span className="qm-item-price">{item.price}</span>
      </div>
      {item[`desc${suffix}`] && <p className="qm-item-desc-sm">{item[`desc${suffix}`]}</p>}
      {!item.isAvailable && <UnavailableBadge t={t} />}
      <AllergenTags ids={item.allergenIds} allergenMap={allergenMap} suffix={suffix} />
    </div>
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
  allergenMap,
  t,
  onItemView,
}: {
  item: PubItem;
  suffix: Suffix;
  photoStyle: MenuPhotoStyle;
  allergenMap: Map<string, PubAllergen>;
  t: (al: string, en: string) => string;
  onItemView?: (id: string) => void;
}) {
  const onClick = onItemView ? () => onItemView(item.id) : undefined;
  const name = item[`name${suffix}`];
  const desc = item[`desc${suffix}`];
  const hasImage = Boolean(item.imageUrl);
  const showThumb = photoStyle === "thumbnail" && hasImage;
  const showLarge = photoStyle === "large" && hasImage;

  const priceBadge = (
    <div className="qm-price-badge">
      <span className="qm-num">{item.price}</span>
      <span className="qm-cur">ALL</span>
    </div>
  );

  const nameEl = (
    <h3 className="qm-card-name">
      {item.isChefPick && <span className="qm-chef" title={t("Rekomandim i Shefit", "Chef's pick")}>★</span>}
      {name}
    </h3>
  );

  const extras = (
    <>
      {!item.isAvailable && <UnavailableBadge t={t} />}
      <AllergenTags ids={item.allergenIds} allergenMap={allergenMap} suffix={suffix} />
    </>
  );

  if (showThumb) {
    return (
      <article className={`qm-card ${item.isAvailable ? "" : "is-unavailable"}`} onClick={onClick}>
        <div className="qm-card-thumbrow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qm-card-thumb" src={item.imageUrl!} alt="" />
          <div className="qm-card-thumbmain">
            <div className="qm-card-top">
              {nameEl}
              {priceBadge}
            </div>
            <div className="qm-card-rule" />
            {desc && <p className="qm-card-desc">{desc}</p>}
            {extras}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`qm-card ${showLarge ? "qm-card--photo" : ""} ${item.isAvailable ? "" : "is-unavailable"}`} onClick={onClick}>
      {showLarge && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="qm-card-photo" src={item.imageUrl!} alt="" />
      )}
      <div className="qm-card-top">
        {nameEl}
        {priceBadge}
      </div>
      <div className="qm-card-rule" />
      {desc && <p className="qm-card-desc">{desc}</p>}
      {extras}
    </article>
  );
}
