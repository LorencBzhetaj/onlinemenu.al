import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { googleFontsHref, DEFAULT_HEADING, DEFAULT_BODY } from "@/lib/branding";
import { mixHex, lighten } from "@/lib/color";
import "./menu.css";
import {
  PublicMenu,
  type PubCategory,
  type PubTasting,
  type PubCourse,
  type PubRestaurant,
} from "./public-menu";

export const revalidate = 60;

async function getRestaurant(slug: string) {
  return prisma.restaurant.findUnique({
    where: { slug },
    include: {
      subscription: true,
      categories: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
          subcategories: {
            orderBy: { sortOrder: "asc" },
            include: { items: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      tastingMenus: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const r = await prisma.restaurant.findUnique({
    where: { slug: params.slug },
    select: { name: true, address: true },
  });
  if (!r) return { title: "Menu" };
  return {
    title: `${r.name} — Menu`,
    description: `Menu — ${r.name}${r.address ? `, ${r.address}` : ""}.`,
  };
}

function isActive(sub: { status: string; expiresAt: Date } | null): boolean {
  if (!sub) return false;
  if (sub.status === "expired" || sub.status === "cancelled") return false;
  return new Date(sub.expiresAt) >= new Date();
}

// courses vjen si Json nativ nga PostgreSQL (array/objekt), por trajtojmë edhe
// rastin kur është ende string (të dhëna të vjetra), për robustësi.
function parseCourses(value: unknown): PubCourse[] {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    return {
      titleAl: String(o.titleAl ?? ""),
      titleEn: String(o.titleEn ?? ""),
      descAl: String(o.descAl ?? ""),
      descEn: String(o.descEn ?? ""),
    };
  });
}

export default async function PublicMenuPage({
  params,
}: {
  params: { slug: string };
}) {
  const restaurant = await getRestaurant(params.slug);
  if (!restaurant) notFound();

  // Menuja shfaqet vetëm nëse është e publikuar dhe abonimi aktiv.
  if (!restaurant.isPublished || !isActive(restaurant.subscription)) {
    return (
      <main
        style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f1720", color: "#f5f0e6", padding: "0 24px", textAlign: "center" }}
      >
        <div>
          <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>{restaurant.name}</h1>
          <p style={{ opacity: 0.7 }}>Menu përkohësisht jo aktive. Ju lutemi provoni më vonë.</p>
        </div>
      </main>
    );
  }

  // ── Tema nga ngjyrat e restorantit ──
  const primary = restaurant.primaryColor ?? "#0f1720";
  const accent = restaurant.accentColor ?? "#c9a24b";
  const fontHeading = restaurant.fontHeading ?? DEFAULT_HEADING;
  const fontBody = restaurant.fontBody ?? DEFAULT_BODY;

  const themeVars = {
    "--charcoal": primary,
    "--ink": primary,
    "--gold": accent,
    "--gold-soft": lighten(accent, 0.5),
    "--iris-deep": primary,
    "--olive-dark": mixHex(accent, primary, 0.35),
    "--hero-bg": `linear-gradient(160deg, ${primary} 0%, ${mixHex(primary, accent, 0.5)} 55%, ${accent} 100%)`,
    "--font-display": `"${fontHeading}", serif`,
    "--font-body": `"${fontBody}", serif`,
  } as React.CSSProperties;

  // Fontet: heading + body të restorantit + script (Dancing Script) + UI (Jost).
  const fontsHref = googleFontsHref([fontHeading, fontBody, "Dancing Script", "Jost"]);

  // ── Mapim + filtrim (vetëm kategori me të paktën 1 artikull të dukshëm) ──
  const categories: PubCategory[] = restaurant.categories
    .map((c) => ({
      id: c.id,
      nameAl: c.nameAl,
      nameEn: c.nameEn,
      icon: c.icon,
      items: c.items.map((i) => ({
        id: i.id,
        nameAl: i.nameAl,
        nameEn: i.nameEn,
        descAl: i.descAl,
        descEn: i.descEn,
        price: i.price,
        imageUrl: i.imageUrl,
      })),
      subcategories: c.subcategories
        .map((s) => ({
          id: s.id,
          nameAl: s.nameAl,
          nameEn: s.nameEn,
          items: s.items.map((i) => ({
            id: i.id,
            nameAl: i.nameAl,
            nameEn: i.nameEn,
            descAl: i.descAl,
            descEn: i.descEn,
            price: i.price,
            imageUrl: i.imageUrl,
          })),
        }))
        .filter((s) => s.items.length > 0),
    }))
    .filter((c) => c.items.length > 0 || c.subcategories.length > 0);

  const tastingMenus: PubTasting[] = restaurant.tastingMenus.map((m) => ({
    id: m.id,
    name: m.name,
    price: m.price,
    guestCount: m.guestCount,
    courses: parseCourses(m.courses),
  }));

  const pubRestaurant: PubRestaurant = {
    name: restaurant.name,
    logoUrl: restaurant.logoUrl,
    phone: restaurant.phone,
    whatsapp: restaurant.whatsapp,
    address: restaurant.address,
    estYear: restaurant.estYear,
    taglineAl: restaurant.taglineAl,
    taglineEn: restaurant.taglineEn,
    subtitleAl: restaurant.subtitleAl,
    subtitleEn: restaurant.subtitleEn,
  };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={fontsHref} />

      <div className="qr-menu" style={themeVars}>
        <PublicMenu
          restaurant={pubRestaurant}
          categories={categories}
          tastingMenus={tastingMenus}
          photoStyle={(restaurant.menuPhotoStyle as "large" | "thumbnail" | "none") ?? "none"}
        />
      </div>
    </>
  );
}
