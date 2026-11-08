"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SearchFilters, SearchFacets } from "@/modules/restaurants/search";
import { MAX_GUESTS } from "@/modules/restaurants/search";

const FIELD =
  "min-h-12 w-full rounded-2xl border-2 border-om-line bg-om-white px-3 text-base text-om-aubergine outline-none transition focus:border-om-aubergine";
const LABEL = "mb-1 block text-sm font-extrabold text-om-ink-soft";

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
      role="search"
      className="rounded-3xl border border-om-line bg-om-surface p-4 font-om-body text-om-aubergine sm:p-5"
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
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-om-aubergine px-7 text-base font-extrabold text-white transition disabled:opacity-60"
        >
          {pending ? "Duke kërkuar…" : "Kërko"}
        </button>
        {hasAny && (
          <button type="button" onClick={reset} className="min-h-11 px-2 text-sm font-bold text-om-ink-soft underline-offset-4 transition hover:text-om-aubergine hover:underline">
            Pastro filtrat
          </button>
        )}
      </div>
    </form>
  );
}
