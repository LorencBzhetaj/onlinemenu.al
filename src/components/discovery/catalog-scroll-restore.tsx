"use client";

// Ruan pozicionin e katalogut kur vizitori hap një menu dhe e rikthen kur kthehet me "Kthehu".
// Ruhet vetëm në sessionStorage të kësaj skede (pa të dhëna personale): scrollY + scrollLeft i
// rreshtave horizontalë me `data-scroll-key`. Çelësi = rruga + parametrat e katalogut.
import { useEffect } from "react";

const PREFIX = "om-catalog-scroll:";
const MAX_AGE_MS = 30 * 60 * 1000;

type Saved = { y: number; rows: Record<string, number>; at: number };

function key() {
  return PREFIX + location.pathname + location.search;
}

export function CatalogScrollRestore() {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key());
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        sessionStorage.removeItem(key());
        if (Date.now() - s.at < MAX_AGE_MS) {
          requestAnimationFrame(() => {
            window.scrollTo(0, s.y);
            document.querySelectorAll<HTMLElement>("[data-scroll-key]").forEach((el) => {
              const v = s.rows[el.dataset.scrollKey!];
              if (typeof v === "number") el.scrollLeft = v;
            });
          });
        }
      }
    } catch {
      /* ruajtja mund të jetë e bllokuar — katalogu funksionon njësoj */
    }

    function save(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href*='/menu']");
      if (!a) return;
      try {
        const rows: Record<string, number> = {};
        document.querySelectorAll<HTMLElement>("[data-scroll-key]").forEach((el) => {
          rows[el.dataset.scrollKey!] = el.scrollLeft;
        });
        sessionStorage.setItem(key(), JSON.stringify({ y: window.scrollY, rows, at: Date.now() } satisfies Saved));
      } catch {
        /* pa ruajtje */
      }
    }
    document.addEventListener("click", save, true);
    return () => document.removeEventListener("click", save, true);
  }, []);
  return null;
}
