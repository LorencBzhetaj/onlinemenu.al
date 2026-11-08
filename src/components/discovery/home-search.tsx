"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SearchFacets } from "@/modules/restaurants/search";

/** Kërkimi i kryefaqes → /restaurants (omit vlerat bosh). No-JS: forma shkon te /restaurants. */
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
      className="flex w-full flex-col gap-2 rounded-3xl border border-om-line bg-om-surface p-2 shadow-[0_10px_28px_rgba(76,24,69,0.08)] sm:flex-row sm:items-stretch"
    >
      {facets.cities.length > 0 && (
        <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-om-white px-4 sm:w-48">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5 shrink-0" aria-hidden="true">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span className="sr-only">Qyteti</span>
          <select
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="min-h-12 w-full bg-transparent text-base font-bold text-om-aubergine outline-none"
          >
            <option value="">Çdo qytet</option>
            {facets.cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl bg-om-white px-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5 shrink-0" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="sr-only">Kërko</span>
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kërko restorant, kuzhinë ose emër…"
          maxLength={80}
          className="min-h-12 w-full bg-transparent text-base text-om-aubergine outline-none placeholder:text-om-ink-soft"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-om-aubergine px-7 text-base font-extrabold text-white transition disabled:opacity-60"
      >
        {pending ? "Duke kërkuar…" : "Kërko"}
      </button>
    </form>
  );
}
