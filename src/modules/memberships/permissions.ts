// Lejet sipas rolit të anëtarësimit (Faza 1). Allowlist SHTERUESE action → rolet e lejuar.
// Mungesa e një action-i = deny-by-default (veprim i panjohur refuzohet).

export type Role = "OWNER" | "MANAGER" | "STAFF";

export const PERMISSIONS: Record<string, Role[]> = {
  // Menu
  "menu:read": ["OWNER", "MANAGER", "STAFF"],
  "menu:write": ["OWNER", "MANAGER"],
  // Profili / branding / lidhje / cilësime private
  "branding:read": ["OWNER", "MANAGER"],
  "branding:write": ["OWNER", "MANAGER"],
  "settings:read": ["OWNER", "MANAGER"],
  "settings:write": ["OWNER", "MANAGER"],
  "links:read": ["OWNER", "MANAGER"],
  "links:write": ["OWNER", "MANAGER"],
  "qr:read": ["OWNER", "MANAGER"],
  "analytics:read": ["OWNER", "MANAGER"],
  // Vetëm OWNER (financë / staf / abonim)
  "billing:read": ["OWNER"],
  "subscription:read": ["OWNER"],
  "team:read": ["OWNER"],
  "team:write": ["OWNER"],
  // Booking (Faza 5): operacionale për gjithë stafin; konfigurimi vetëm OWNER/MANAGER.
  "reservations:read": ["OWNER", "MANAGER", "STAFF"],
  "reservations:write": ["OWNER", "MANAGER", "STAFF"],
  "customers:read": ["OWNER", "MANAGER", "STAFF"],
  "customers:write": ["OWNER", "MANAGER"],
  "booking:config": ["OWNER", "MANAGER"], // tavolina/zona/kombinime/orare/mbyllje/kufij/cilësime booking
};

export function isRole(x: unknown): x is Role {
  return x === "OWNER" || x === "MANAGER" || x === "STAFF";
}

/** true vetëm nëse `action` njihet DHE roli është në allowlist-in e tij. */
export function roleCan(role: Role, action: string): boolean {
  const allowed = PERMISSIONS[action];
  if (!allowed) return false; // action i panjohur → deny
  return allowed.includes(role);
}
