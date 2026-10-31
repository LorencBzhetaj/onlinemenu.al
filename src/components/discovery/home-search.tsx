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
      className="mx-auto mt-10 flex w-full max-w-xl flex-col gap-3 rounded-card border border-line bg-surface p-3 shadow-card sm:flex-row sm:items-center"
    >
      <input
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Kërko restorant…"
        maxLength={80}
        className="min-h-11 flex-1 rounded-field border border-line bg-canvas px-4 text-sm text-ink outline-none transition focus:border-primary/60"
      />
      {facets.cities.length > 0 && (
        <select
          name="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="min-h-11 rounded-field border border-line bg-canvas px-3 text-sm text-ink outline-none transition focus:border-primary/60"
        >
          <option value="">Çdo qytet</option>
          {facets.cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {pending ? "Duke kërkuar…" : "Kërko"}
      </button>
    </form>
  );
}
