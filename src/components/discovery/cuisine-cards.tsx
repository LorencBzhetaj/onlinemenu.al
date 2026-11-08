import Link from "next/link";
import { ChefMascot } from "@/components/public/chef-mascot";
import { cuisineIconSrc } from "@/lib/cuisine-icons";

/**
 * Karta të vogla kuzhinash në Zbulo — vetëm nga kuzhinat reale të restoranteve të publikuara.
 * Ikona: Shefi i Bukës sipas kuzhinës (emri i normalizuar → ikonë; e panjohura → rezervë).
 * "Të gjitha" mbetet Shefi në kutinë rozë. Kurrë mbi foto, çmime apo përshkrime pjatash.
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cuisineIconSrc(c)} alt="" width={48} height={48} loading="lazy" decoding="async" className="h-12 w-12 object-contain" />
              <span className="line-clamp-1">{c}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
