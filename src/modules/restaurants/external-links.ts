// Lidhjet e jashtme opsionale të profilit (Wolt, Maps, Instagram, Website).
// Hapen nga shfletuesi i klientit; serveri NUK bën fetch automatik të këtyre URL-ve
// dhe nuk merr menu/porosi prej tyre. Telefoni ruhet veçmas (Restaurant.phone, `tel:`).

export const LINK_TYPES = ["WOLT", "MAPS", "INSTAGRAM", "WEBSITE"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export function isLinkType(x: unknown): x is LinkType {
  return typeof x === "string" && (LINK_TYPES as readonly string[]).includes(x);
}

export const LINK_META: Record<LinkType, { label: string; hint: string }> = {
  WOLT: { label: "Wolt", hint: "Lidhje e jashtme te Wolt (vetëm host-et zyrtare)." },
  MAPS: { label: "Google Maps", hint: "Lidhje e vendndodhjes në Google Maps." },
  INSTAGRAM: { label: "Instagram", hint: "Profili zyrtar në Instagram." },
  WEBSITE: { label: "Faqja zyrtare", hint: "Faqja e internetit e restorantit (HTTPS)." },
};

// Host-et e lejuar për Wolt (vetëm zyrtarë; pa fetch automatik nga serveri).
const WOLT_HOSTS = ["wolt.com"];
const INSTAGRAM_HOSTS = ["instagram.com", "instagr.am"];
// Host-et e njohur për lidhje harte (Google Maps + short links).
const MAPS_HOSTS = ["google.com", "goo.gl", "maps.app.goo.gl", "g.co"];

function hostMatches(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return allowed.some((a) => h === a || h.endsWith(`.${a}`));
}

export type LinkValidation = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validon një URL lidhjeje sipas llojit. Rregulla: vetëm HTTPS; host allowlist për
 * Wolt/Instagram/Maps; WEBSITE pranon çdo host HTTPS. Pa normalizim që ndryshon domenin.
 */
export function validateLinkUrl(type: LinkType, raw: string): LinkValidation {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: false, error: "URL-ja është bosh." };

  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return { ok: false, error: "URL-ja nuk është e vlefshme." };
  }

  if (u.protocol !== "https:") {
    return { ok: false, error: "Lejohen vetëm lidhje HTTPS." };
  }

  switch (type) {
    case "WOLT":
      if (!hostMatches(u.hostname, WOLT_HOSTS)) {
        return { ok: false, error: "Lidhja Wolt duhet të jetë te wolt.com." };
      }
      break;
    case "INSTAGRAM":
      if (!hostMatches(u.hostname, INSTAGRAM_HOSTS)) {
        return { ok: false, error: "Lidhja Instagram duhet të jetë te instagram.com." };
      }
      break;
    case "MAPS":
      if (!hostMatches(u.hostname, MAPS_HOSTS)) {
        return { ok: false, error: "Lidhja e hartës duhet të jetë te Google Maps." };
      }
      break;
    case "WEBSITE":
      // Çdo host HTTPS i vlefshëm lejohet.
      break;
  }

  return { ok: true, url: u.toString() };
}
