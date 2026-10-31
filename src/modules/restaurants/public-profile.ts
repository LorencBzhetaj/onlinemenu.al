import { prisma } from "@/lib/prisma";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { isWindowActive } from "@/modules/menu/schedule";
import type { LinkType } from "./external-links";

export type PublicLink = { type: LinkType; url: string };

export type PublicGate = {
  isPublished: boolean;
  suspended: boolean;
  menuActive: boolean;
  bookingActive: boolean;
};

export type PublicProfile = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  cuisine: string | null;
  mapsUrl: string | null;
  aboutAl: string | null;
  aboutEn: string | null;
  estYear: number | null;
  taglineAl: string | null;
  taglineEn: string | null;
  subtitleAl: string | null;
  subtitleEn: string | null;
  menuPhotoStyle: string;
  links: PublicLink[];
  gate: PublicGate;
};

/**
 * Profili publik nga një burim i vetëm. Përfshin lidhjet e aktivizuara dhe gate-in
 * (publikim + pezullim + entitlement MENU/BOOKING). Kthen null nëse restoranti s'ekziston.
 *
 * NUK fsheh profilin kur MENU/BOOKING janë joaktive: profili mbetet publik me shpjegim
 * (përveç kur restoranti është i pezulluar ose jo i publikuar) — sipas masterplanit §7.
 */
export async function getPublicProfile(slug: string): Promise<PublicProfile | null> {
  const r = await prisma.restaurant.findUnique({
    where: { slug },
    include: { externalLinks: { where: { enabled: true } } },
  });
  if (!r) return null;

  const [menuActive, bookingActive] = await Promise.all([
    hasEntitlement(r.id, "MENU"),
    hasEntitlement(r.id, "BOOKING"),
  ]);

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logoUrl,
    primaryColor: r.primaryColor,
    accentColor: r.accentColor,
    fontHeading: r.fontHeading,
    fontBody: r.fontBody,
    phone: r.phone,
    whatsapp: r.whatsapp,
    address: r.address,
    city: r.city,
    cuisine: r.cuisine,
    mapsUrl: r.mapsUrl,
    aboutAl: r.aboutAl,
    aboutEn: r.aboutEn,
    estYear: r.estYear,
    taglineAl: r.taglineAl,
    taglineEn: r.taglineEn,
    subtitleAl: r.subtitleAl,
    subtitleEn: r.subtitleEn,
    menuPhotoStyle: r.menuPhotoStyle,
    links: r.externalLinks.map((l) => ({ type: l.type as LinkType, url: l.url })),
    gate: {
      isPublished: r.isPublished,
      suspended: r.suspendedAt != null,
      menuActive,
      bookingActive,
    },
  };
}

/**
 * Destinacioni i rezervimit për Fazën 3: shfaqet VETËM kur moduli BOOKING është aktiv
 * DHE ekziston një destinacion funksional (WhatsApp ose telefon i restorantit). Kjo s'është
 * motori i rezervimeve (Faza 5) dhe NUK lidhet me booking-un live të Gjeçaj — vetëm kontakt.
 * Kthen null kur moduli s'është aktiv ose s'ka kontakt → butoni nuk shfaqet.
 */
export function reserveDestination(p: {
  gate: PublicGate;
  whatsapp: string | null;
  phone: string | null;
  name: string;
}): string | null {
  if (!p.gate.bookingActive) return null;
  if (p.whatsapp) {
    const msg = `Përshëndetje! Dua të rezervoj një tavolinë te ${p.name}.`;
    return `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(msg)}`;
  }
  if (p.phone) return `tel:${p.phone}`;
  return null;
}

export type PublicAllergen = { id: string; nameAl: string; nameEn: string; icon: string | null };
export type PublicMenuItem = {
  id: string;
  nameAl: string;
  nameEn: string;
  descAl: string | null;
  descEn: string | null;
  price: number;
  imageUrl: string | null;
  isChefPick: boolean;
  isDailyMenu: boolean;
  isAvailable: boolean;
  allergenIds: string[];
};
export type PublicMenuSubcat = { id: string; nameAl: string; nameEn: string; items: PublicMenuItem[] };
export type PublicMenuCategory = {
  id: string;
  nameAl: string;
  nameEn: string;
  icon: string | null;
  items: PublicMenuItem[];
  subcategories: PublicMenuSubcat[];
};

export type PublicMenuData = {
  categories: PublicMenuCategory[];
  allergens: PublicAllergen[];
};

function mapItem(i: {
  id: string;
  nameAl: string;
  nameEn: string;
  descAl: string | null;
  descEn: string | null;
  price: number;
  imageUrl: string | null;
  isChefPick: boolean;
  isDailyMenu: boolean;
  isAvailable: boolean;
  allergens: { allergenId: string }[];
}): PublicMenuItem {
  return {
    id: i.id,
    nameAl: i.nameAl,
    nameEn: i.nameEn,
    descAl: i.descAl,
    descEn: i.descEn,
    price: i.price,
    imageUrl: i.imageUrl,
    isChefPick: i.isChefPick,
    isDailyMenu: i.isDailyMenu,
    isAvailable: i.isAvailable,
    allergenIds: i.allergens.map((a) => a.allergenId),
  };
}

/**
 * Të dhënat e menusë publike për një restorant (sipas id). Filtron:
 *  - vetëm artikuj isVisible (të padisponueshëm mbesin, të shënuar nga klienti),
 *  - kategoritë me orar vetëm kur dritarja është aktive TANI (Europe/Tirane),
 *  - kategori/nënkategori bosh hiqen.
 */
export async function getPublicMenuData(
  restaurantId: string,
  now: Date = new Date()
): Promise<PublicMenuData> {
  const [categories, allergens] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: "asc" },
      include: {
        schedule: true,
        items: {
          where: { isVisible: true },
          orderBy: { sortOrder: "asc" },
          include: { allergens: { select: { allergenId: true } } },
        },
        subcategories: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              where: { isVisible: true },
              orderBy: { sortOrder: "asc" },
              include: { allergens: { select: { allergenId: true } } },
            },
          },
        },
      },
    }),
    prisma.allergen.findMany({ where: { restaurantId }, orderBy: { sortOrder: "asc" } }),
  ]);

  const mapped: PublicMenuCategory[] = categories
    .filter((c) =>
      // Kategori pa orar → gjithmonë; me orar → vetëm kur dritarja është aktive.
      !c.schedule
        ? true
        : isWindowActive(
            { days: c.schedule.days, startMinutes: c.schedule.startMinutes, endMinutes: c.schedule.endMinutes },
            now
          )
    )
    .map((c) => ({
      id: c.id,
      nameAl: c.nameAl,
      nameEn: c.nameEn,
      icon: c.icon,
      items: c.items.map(mapItem),
      subcategories: c.subcategories
        .map((s) => ({ id: s.id, nameAl: s.nameAl, nameEn: s.nameEn, items: s.items.map(mapItem) }))
        .filter((s) => s.items.length > 0),
    }))
    .filter((c) => c.items.length > 0 || c.subcategories.length > 0);

  return {
    categories: mapped,
    allergens: allergens.map((a) => ({ id: a.id, nameAl: a.nameAl, nameEn: a.nameEn, icon: a.icon })),
  };
}
