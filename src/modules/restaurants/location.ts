// Vendndodhja e restorantit për seksionin "Vendndodhja" të profilit.
//
// Burimet e koordinatave (vetëm të dhëna reale, kurrë të sajuara):
//  1. Restaurant.latitude/longitude — të vendosura nga pronari te Cilësime.
//  2. Lidhja MAPS e pronarit, VETËM kur URL-ja vetë përmban koordinata (p.sh. ".../@41.32,19.81,17z").
//     Short-links (maps.app.goo.gl) s'zgjidhen: serveri s'bën fetch të lidhjeve të jashtme.
// Pa koordinata: profili shfaq adresën dhe lidhjen ekzistuese të hartës, pa hartë.

export type LatLng = { lat: number; lng: number };

/** Validon një koordinatë: numër i fundëm brenda kufijve. Kthen null për bosh/të pavlefshme. */
export function parseCoord(v: unknown, kind: "lat" | "lng"): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  if (!/^-?\d{1,3}(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  const max = kind === "lat" ? 90 : 180;
  if (!Number.isFinite(n) || n < -max || n > max) return null;
  return n;
}

function pair(latRaw: string, lngRaw: string): LatLng | null {
  const lat = parseCoord(latRaw, "lat");
  const lng = parseCoord(lngRaw, "lng");
  if (lat === null || lng === null) return null;
  // (0,0) s'është vendndodhje reale restoranti — trajtohet si mungesë.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Nxjerr koordinata nga një URL Google Maps vetëm kur ato janë të shkruara në URL. */
export function coordsFromMapsUrl(url: string | null | undefined): LatLng | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const num = "(-?\\d{1,3}\\.\\d+)";
  // Pini i vendit (!3d<lat>!4d<lng>) ka përparësi ndaj qendrës së pamjes (@lat,lng).
  const pin = new RegExp(`!3d${num}!4d${num}`).exec(u.pathname + u.hash);
  if (pin) return pair(pin[1], pin[2]);
  for (const key of ["q", "query", "ll", "destination", "daddr"]) {
    const v = u.searchParams.get(key);
    const m = v ? new RegExp(`^${num},\\s*${num}$`).exec(v.trim()) : null;
    if (m) return pair(m[1], m[2]);
  }
  const at = new RegExp(`@${num},${num}`).exec(u.pathname);
  if (at) return pair(at[1], at[2]);
  return null;
}

export function resolveRestaurantCoords(r: {
  latitude: number | null;
  longitude: number | null;
  mapsLink: string | null;
}): LatLng | null {
  if (r.latitude !== null && r.longitude !== null) {
    const p = pair(String(r.latitude), String(r.longitude));
    if (p) return p;
  }
  return coordsFromMapsUrl(r.mapsLink);
}

/**
 * Shërbimi routing (OSRM-compatible, p.sh. ".../route/v1/driving"), i zgjedhur nga pronari i platformës
 * përmes ROUTING_URL. Bosh (default) → pa itinerar në hartë; mbetet "Merr udhëzime".
 * Asnjë shërbim me pagesë s'aktivizohet automatikisht.
 */
export function routingServiceUrl(): string | null {
  const raw = process.env.ROUTING_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Lidhja "Merr udhëzime": hap aplikacionin e hartave me destinacionin. Pa origjinë —
 * aplikacioni përdor vetë vendndodhjen e pajisjes; pozicioni i klientit s'del në URL.
 */
export function directionsUrl(dest: { coords: LatLng | null; address: string | null }): string | null {
  const target = dest.coords ? `${dest.coords.lat},${dest.coords.lng}` : dest.address?.trim();
  if (!target) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
}
