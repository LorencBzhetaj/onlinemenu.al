"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SearchFilters, SearchFacets } from "@/modules/restaurants/search";
import { MAX_GUESTS } from "@/modules/restaurants/search";

const FIELD =
  "min-h-11 w-full rounded-field border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary/60";
const LABEL = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted";

/** Ndërton querystring-un duke lënë jashtë vlerat bosh dhe duke rikthyer page→1. */
function buildQuery(v: {
  q: string;
  city: string;
  cuisine: string;
  date: string;
  time: string;
  guests: string;
}): string {
  const p = new URLSearchParams();
  if (v.q.trim()) p.set("q", v.q.trim());
  if (v.city) p.set("city", v.city);
  if (v.cuisine) p.set("cuisine", v.cuisine);
  if (v.date) p.set("date", v.date);
  if (v.time) p.set("time", v.time);
  if (v.guests) p.set("guests", v.guests);
  return p.toString();
}

export function SearchFilters({
  filters,
  facets,
  todayStr,
}: {
  filters: SearchFilters;
  facets: SearchFacets;
  todayStr: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(filters.q ?? "");
  const [city, setCity] = useState(filters.city ?? "");
  const [cuisine, setCuisine] = useState(filters.cuisine ?? "");
  const [date, setDate] = useState(filters.date ?? "");
  const [time, setTime] = useState(filters.time ?? "");
  const [guests, setGuests] = useState(filters.guests ? String(filters.guests) : "");

  function apply() {
    const qs = buildQuery({ q, city, cuisine, date, time, guests });
    startTransition(() => router.push(qs ? `/restaurants?${qs}` : "/restaurants"));
  }

  function reset() {
    setQ("");
    setCity("");
    setCuisine("");
    setDate("");
    setTime("");
    setGuests("");
    startTransition(() => router.push("/restaurants"));
  }

  const hasAny = q || city || cuisine || date || time || guests;

  return (
    <form
      className="rounded-card-sm sm:rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
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
        <div>
          <label className={LABEL} htmlFor="f-date">Data</label>
          <input id="f-date" type="date" className={FIELD} value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="f-time">Ora</label>
          <input id="f-time" type="time" className={FIELD} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="f-guests">Persona</label>
          <select id="f-guests" className={FIELD} value={guests} onChange={(e) => setGuests(e.target.value)}>
            <option value="">—</option>
            {Array.from({ length: MAX_GUESTS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "Duke kërkuar…" : "Kërko"}
        </button>
        {hasAny && (
          <button type="button" onClick={reset} className="text-sm text-muted transition hover:text-ink">
            Pastro filtrat
          </button>
        )}
      </div>
    </form>
  );
}
