"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SearchFilters, SearchFacets } from "@/modules/restaurants/search";

const FIELD =
  "h-11 w-full rounded-xl border-2 border-om-line bg-om-white px-3 text-[15px] text-om-aubergine outline-none transition focus:border-om-aubergine";
const LABEL = "mb-1 block text-sm font-extrabold text-om-ink-soft";

/** Querystring pa vlera bosh; page→1. Vetëm kërkim restoranti (rezervimi bëhet te faqja e restorantit). */
function buildQuery(v: { q: string; city: string; cuisine: string }): string {
  const p = new URLSearchParams();
  if (v.q.trim()) p.set("q", v.q.trim());
  if (v.city) p.set("city", v.city);
  if (v.cuisine) p.set("cuisine", v.cuisine);
  return p.toString();
}

export function SearchFilters({ filters, facets }: { filters: SearchFilters; facets: SearchFacets }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(filters.q ?? "");
  const [city, setCity] = useState(filters.city ?? "");
  const [cuisine, setCuisine] = useState(filters.cuisine ?? "");

  function apply() {
    const qs = buildQuery({ q, city, cuisine });
    startTransition(() => router.push(qs ? `/restaurants?${qs}` : "/restaurants"));
  }

  function reset() {
    setQ("");
    setCity("");
    setCuisine("");
    startTransition(() => router.push("/restaurants"));
  }

  const hasAny = q || city || cuisine;

  return (
    <form
      role="search"
      className="rounded-3xl border border-om-line bg-om-surface p-3 font-om-body text-om-aubergine sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={LABEL} htmlFor="f-q">Emri</label>
          <input id="f-q" className={FIELD} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kërko restorant…" maxLength={80} />
        </div>
        <div>
          <label className={LABEL} htmlFor="f-city">Qyteti</label>
          <select id="f-city" className={FIELD} value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Të gjitha</option>
            {facets.cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="f-cuisine">Kuzhina</label>
          <select id="f-cuisine" className={FIELD} value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
            <option value="">Të gjitha</option>
            {facets.cuisines.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="col-span-2 inline-flex h-11 items-center justify-center rounded-xl bg-om-aubergine px-6 text-[15px] font-extrabold text-white transition disabled:opacity-60 sm:col-span-1"
        >
          {pending ? "Duke kërkuar…" : "Kërko"}
        </button>
      </div>
      {hasAny && (
        <button type="button" onClick={reset} className="mt-2 min-h-11 px-1 text-sm font-bold text-om-ink-soft underline-offset-4 transition hover:text-om-aubergine hover:underline">
          Pastro filtrat
        </button>
      )}
    </form>
  );
}
