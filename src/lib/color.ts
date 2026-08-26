// Ndihmës të vegjël ngjyrash për të derivuar tema nga primaryColor + accentColor.

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

/** Përzien dy hex-e: t=0 -> a, t=1 -> b. */
export function mixHex(a: string, b: string, t = 0.5): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Çel një ngjyrë drejt të bardhës (amount 0..1). */
export function lighten(hex: string, amount = 0.5): string {
  return mixHex(hex, "#ffffff", amount);
}

/** Errëson një ngjyrë drejt të zezës (amount 0..1). */
export function darken(hex: string, amount = 0.5): string {
  return mixHex(hex, "#000000", amount);
}
