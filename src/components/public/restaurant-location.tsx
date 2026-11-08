"use client";

// Seksioni "Vendndodhja" i profilit publik.
//  - Harta (Leaflet + tile OpenStreetMap, pa çelës/pagesë) ngarkohet vetëm kur seksioni afrohet në ekran.
//  - "Përdor vendndodhjen time" shfaqet vetëm kur është konfiguruar një shërbim routing (ROUTING_URL,
//    OSRM-compatible) dhe kërkon lejen e vendndodhjes VETËM pas klikimit.
//  - Pini "Ti" + itinerari vizatohen vetëm nga një përgjigje reale e shërbimit routing; distanca/koha
//    janë ato të përgjigjes. Pozicioni i klientit s'ruhet, s'dërgohet te serveri ynë dhe s'shfaqet.
//  - Pa routing / leje e refuzuar / gabim: adresa, pini i restorantit dhe "Merr udhëzime" funksionojnë.
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLang } from "./use-lang";

type LatLng = { lat: number; lng: number };
type Geo = "idle" | "asking" | "routing" | "routed" | "denied" | "unavailable" | "noroute";

function pinIcon(L: typeof Leaflet, kind: "restaurant" | "you", label: string) {
  const safe = label.replace(/[&<>"']/g, "");
  return L.divIcon({
    className: "om-pin-wrap",
    html: `<span class="om-pin om-pin--${kind}"><span class="om-pin-label">${safe}</span></span>`,
    iconSize: [40, 48],
    iconAnchor: [20, 46],
  });
}

export function RestaurantLocation({
  name,
  address,
  coords,
  mapsLink,
  directionsHref,
  routingUrl,
}: {
  name: string;
  address: string | null;
  coords: LatLng | null;
  mapsLink: string | null;
  directionsHref: string | null;
  routingUrl: string | null;
}) {
  const { lang } = useLang();
  const t = (al: string, en: string) => (lang === "al" ? al : en);

  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const routeRef = useRef<Leaflet.LayerGroup | null>(null);

  const [near, setNear] = useState(false);
  const [mapState, setMapState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [geo, setGeo] = useState<Geo>("idle");
  const [summary, setSummary] = useState<{ km: number; min: number } | null>(null);

  // 1) Ngarkim dembel: harta krijohet vetëm kur seksioni afrohet në ekran.
  useEffect(() => {
    const el = boxRef.current;
    if (!coords || !el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "240px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [coords]);

  // 2) Krijimi i hartës me pinin e restorantit.
  useEffect(() => {
    if (!near || !coords || mapRef.current) return;
    let cancelled = false;
    setMapState("loading");
    import("leaflet")
      .then((mod) => {
        const L = ((mod as unknown as { default?: typeof Leaflet }).default ?? mod) as typeof Leaflet;
        if (cancelled || !boxRef.current) return;
        leafletRef.current = L;
        const map = L.map(boxRef.current, {
          center: [coords.lat, coords.lng],
          zoom: 16,
          scrollWheelZoom: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        L.marker([coords.lat, coords.lng], { icon: pinIcon(L, "restaurant", ""), title: name, alt: name, keyboard: false }).addTo(map);
        mapRef.current = map;
        setMapState("ready");
      })
      .catch(() => {
        if (!cancelled) setMapState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [near, coords, name]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  const clearRoute = useCallback(() => {
    routeRef.current?.remove();
    routeRef.current = null;
    setSummary(null);
    setGeo("idle");
    if (coords) mapRef.current?.setView([coords.lat, coords.lng], 16);
  }, [coords]);

  // 3) "Përdor vendndodhjen time": leja kërkohet vetëm këtu, pas klikimit.
  const useMyLocation = useCallback(() => {
    if (!routingUrl || !coords || !mapRef.current || !leafletRef.current) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo("unavailable");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeo("routing");
        try {
          const url = `${routingUrl.replace(/\/$/, "")}/${from.lng},${from.lat};${coords.lng},${coords.lat}?overview=full&geometries=geojson`;
          const r = await fetch(url);
          const d = await r.json();
          const route = d?.routes?.[0];
          const line: [number, number][] | undefined = route?.geometry?.coordinates;
          if (!r.ok || d?.code !== "Ok" || !line?.length || !mapRef.current || !leafletRef.current) throw new Error("no-route");
          const L = leafletRef.current;
          routeRef.current?.remove();
          const latlngs = line.map(([x, y]) => [y, x] as [number, number]);
          routeRef.current = L.layerGroup([
            L.polyline(latlngs, { color: "#4C1845", weight: 5, opacity: 0.85 }),
            L.marker([from.lat, from.lng], { icon: pinIcon(L, "you", t("Ti", "You")), title: t("Ti", "You"), keyboard: false }),
          ]).addTo(mapRef.current);
          mapRef.current.fitBounds(L.latLngBounds(latlngs), { padding: [32, 32] });
          setSummary({ km: Number(route.distance) / 1000, min: Math.max(1, Math.round(Number(route.duration) / 60)) });
          setGeo("routed");
        } catch {
          setGeo("noroute");
        }
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routingUrl, coords, lang]);

  const status: Record<Geo, string | null> = {
    idle: null,
    asking: t("Duke pritur lejen e vendndodhjes…", "Waiting for location permission…"),
    routing: t("Duke llogaritur itinerarin…", "Calculating the route…"),
    routed: summary
      ? t(
          `Itinerari: ${summary.km.toFixed(1)} km · rreth ${summary.min} min.`,
          `Route: ${summary.km.toFixed(1)} km · about ${summary.min} min.`
        )
      : null,
    denied: t(
      "Leja për vendndodhjen u refuzua. Adresa dhe “Merr udhëzime” funksionojnë njësoj.",
      "Location permission was denied. The address and “Get directions” still work."
    ),
    unavailable: t("Vendndodhja nuk u mor. Përdorni “Merr udhëzime”.", "Couldn't get your location. Use “Get directions”."),
    noroute: t(
      "Itinerari nuk u gjet tani. Hapeni me “Merr udhëzime” në aplikacionin e hartave.",
      "No route right now. Open “Get directions” in your maps app."
    ),
  };

  return (
    <section className="om-loc" aria-labelledby="om-loc-title">
      <h2 id="om-loc-title" className="om-section-h">
        {t("Vendndodhja", "Location")}
      </h2>

      {address && (
        <p className="om-loc-address">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>{address}</span>
        </p>
      )}

      {coords && (
        <div className="om-loc-map-wrap">
          <div ref={boxRef} className="om-loc-map" role="region" aria-label={t(`Harta e ${name}`, `Map of ${name}`)} />
          {mapState !== "ready" && (
            <div className="om-loc-map-placeholder" aria-hidden={mapState !== "error"}>
              {mapState === "error" ? t("Harta nuk u ngarkua.", "The map couldn't load.") : t("Harta…", "Map…")}
            </div>
          )}
        </div>
      )}

      <p className="om-loc-status" role="status" aria-live="polite">
        {status[geo]}
      </p>

      <div className="om-loc-actions">
        {routingUrl && coords && geo !== "routed" && (
          <button
            type="button"
            className="om-btn om-btn--reserve"
            onClick={useMyLocation}
            disabled={mapState !== "ready" || geo === "asking" || geo === "routing"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            {t("Përdor vendndodhjen time", "Use my location")}
          </button>
        )}
        {geo === "routed" && (
          <button type="button" className="om-btn om-btn--ghost" onClick={clearRoute}>
            {t("Fshih itinerarin", "Hide route")}
          </button>
        )}
        {directionsHref && (
          <a className="om-btn om-btn--menu" href={directionsHref} target="_blank" rel="noopener noreferrer">
            {t("Merr udhëzime", "Get directions")} <span aria-hidden="true">↗</span>
          </a>
        )}
        {!coords && mapsLink && (
          <a className="om-btn om-btn--ghost" href={mapsLink} target="_blank" rel="noopener noreferrer">
            {t("Hape në hartë", "Open in maps")} <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </section>
  );
}
