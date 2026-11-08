import Link from "next/link";
import { ChefMascot, type ChefVariant } from "@/components/public/chef-mascot";

/** Varianti i Shefit sipas emrit real të kuzhinës (pa kategori të sajuara). */
function variantFor(cuisine: string): ChefVariant {
  const c = cuisine.toLowerCase();
  if (/pic|pizz/.test(c)) return "pizza";
  if (/burger|fast/.test(c)) return "burger";
  if (/sallat|fresk|vegj|vegan|salad|healthy/.test(c)) return "fresh";
  if (/ëmbël|embel|pastiç|pastic|dessert|kafe|ëmbëlsir/.test(c)) return "sweets";
  return "box";
}

/**
 * Karta të vogla kuzhinash në Zbulo — vetëm nga kuzhinat reale të restoranteve të publikuara.
 * Maskota përdoret këtu (karta të vogla), kurrë mbi foto, çmime apo përshkrime pjatash.
 */
export function CuisineCards({ cuisines, active }: { cuisines: string[]; active?: string | null }) {
  if (cuisines.length === 0) return null;
  return (
    <ul className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label="Kuzhinat">
      <li className="snap-start">
        <Link
          href="/restaurants"
          aria-current={!active ? "page" : undefined}
          className={`flex h-[92px] w-[88px] flex-col items-center justify-center gap-1 rounded-2xl border-2 text-center text-[13px] font-extrabold transition ${
            !active ? "border-om-aubergine bg-om-butter text-om-aubergine" : "border-om-line bg-om-surface text-om-aubergine hover:border-om-pink"
          }`}
        >
          <ChefMascot variant="box" size={44} decorative />
          Të gjitha
        </Link>
      </li>
      {cuisines.map((c) => {
        const isActive = active === c;
        return (
          <li key={c} className="snap-start">
            <Link
              href={`/restaurants?cuisine=${encodeURIComponent(c)}`}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-[92px] w-[88px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 text-center text-[13px] font-extrabold transition ${
                isActive ? "border-om-aubergine bg-om-butter text-om-aubergine" : "border-om-line bg-om-surface text-om-aubergine hover:border-om-pink"
              }`}
            >
              <ChefMascot variant={variantFor(c)} size={44} decorative />
              <span className="line-clamp-1">{c}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
