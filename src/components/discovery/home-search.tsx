"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SearchFacets } from "@/modules/restaurants/search";

/**
 * Kërkimi i kryefaqes (kompakt, një rresht edhe në telefon): qyteti + emri → /restaurants.
 * Vetëm kërkim restoranti — rezervimi bëhet brenda faqes së restorantit. No-JS: forma shkon te /restaurants.
 */
export function HomeSearch({ facets }: { facets: SearchFacets }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (city) p.set("city", city);
    const qs = p.toString();
    startTransition(() => router.push(qs ? `/restaurants?${qs}` : "/restaurants"));
  }

  return (
    <form
      onSubmit={go}
      action="/restaurants"
      method="get"
      role="search"
      className="flex w-full items-center gap-1.5 rounded-2xl border border-om-line bg-om-surface p-1.5 shadow-[0_8px_22px_rgba(76,24,69,0.07)]"
    >
      {facets.cities.length > 0 && (
        <label className="flex h-11 w-[38%] max-w-[170px] shrink-0 items-center gap-1.5 rounded-xl bg-om-white pl-2.5 pr-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span className="sr-only">Qyteti</span>
          <select
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-11 w-full min-w-0 truncate bg-transparent text-sm font-bold text-om-aubergine outline-none"
          >
            <option value="">Çdo qytet</option>
            {facets.cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-om-white px-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="sr-only">Kërko restorant</span>
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kërko restorant…"
          maxLength={80}
          className="h-11 w-full min-w-0 bg-transparent text-[15px] text-om-aubergine outline-none placeholder:text-om-ink-soft"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-label="Kërko"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-om-aubergine text-[15px] font-extrabold text-white transition disabled:opacity-60 sm:w-auto sm:px-5"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5 sm:hidden" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline">{pending ? "Duke kërkuar…" : "Kërko"}</span>
      </button>
    </form>
  );
}
