import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicProfile, getPublicMenuData } from "@/modules/restaurants/public-profile";
import { publicThemeVars, publicFontsHref } from "@/lib/public-theme";
import { PublicTabs } from "@/components/public/public-tabs";
import { PublicFonts } from "@/components/public/public-fonts";
import { Unavailable } from "@/components/public/unavailable";
import { AnalyticsBeacon } from "@/components/public/analytics-beacon";
import {
  PublicMenu,
  type PubCategory,
  type PubCourse,
  type PubTasting,
} from "@/components/public/public-menu";
import { safeReturnPath } from "@/lib/safe-return";
import "@/components/public/menu.css";
import "@/components/public/om-public.css";

export const dynamic = "force-dynamic";

/** Kthehu → katalogu/profili nga ku erdhi vizitori; link direkt → "Te restoranti" (profili). */
function backTarget(slug: string, from: string | string[] | undefined) {
  const safe = safeReturnPath(from);
  return safe ? { href: safe, label: "Kthehu" } : { href: `/restaurants/${slug}`, label: "Te restoranti" };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPublicProfile(params.slug);
  if (!p) return { title: "Menu" };
  return { title: `${p.name} — Menu`, description: `Menu — ${p.name}${p.address ? `, ${p.address}` : ""}.` };
}

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
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const p = await getPublicProfile(params.slug);
  if (!p) notFound();

  // Menuja kërkon: i publikuar, jo i pezulluar, DHE entitlement MENU aktiv.
  if (!p.gate.isPublished || p.gate.suspended || !p.gate.menuActive) {
    return <Unavailable name={p.name} />;
  }

  const [{ categories, allergens }, tasting] = await Promise.all([
    getPublicMenuData(p.id),
    prisma.tastingMenu.findMany({ where: { restaurantId: p.id } }),
  ]);

  const pubCategories: PubCategory[] = categories.map((c) => ({
    id: c.id,
    nameAl: c.nameAl,
    nameEn: c.nameEn,
    icon: c.icon,
    items: c.items.map((i) => ({ ...i })),
    subcategories: c.subcategories.map((s) => ({ id: s.id, nameAl: s.nameAl, nameEn: s.nameEn, items: s.items.map((i) => ({ ...i })) })),
  }));

  const tastingMenus: PubTasting[] = tasting.map((m) => ({
    id: m.id,
    name: m.name,
    price: m.price,
    guestCount: m.guestCount,
    courses: parseCourses(m.courses),
  }));

  return (
    <div className="qr-menu om-menu" style={publicThemeVars(p)}>
      <PublicFonts href={publicFontsHref(p)} />
      <AnalyticsBeacon slug={p.slug} type="menu_view" />
      <PublicMenu
        restaurant={{ name: p.name, logoUrl: p.logoUrl, estYear: p.estYear }}
        categories={pubCategories}
        tastingMenus={tastingMenus}
        allergens={allergens}
        photoStyle={(p.menuPhotoStyle as "large" | "thumbnail" | "none") ?? "none"}
        slug={p.slug}
        back={backTarget(p.slug, searchParams.from)}
      />
      <PublicTabs slug={p.slug} active="menu" labels={{ profile: "Restoranti", menu: "Menuja", info: "Informacion" }} />
    </div>
  );
}
