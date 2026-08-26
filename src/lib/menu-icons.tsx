import type { ReactNode } from "react";

/**
 * Regjistri i ikonave të kategorive (SVG inline, stroke = currentColor).
 * NOTE: këto janë ikona bazë — mund të zëvendësohen me SVG-të e sakta të
 * prototipit Gjeçaj duke ndryshuar path-et më poshtë (çelësat mbeten të njëjtë).
 */

const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, ReactNode> = {
  antipasta: (
    <>
      <path {...P} d="M7 3v7M5 3v4a2 2 0 0 0 4 0V3" />
      <path {...P} d="M15 3c-1.5 0-2 2-2 4s.5 3 2 3 2-1 2-3-.5-4-2-4Z" />
      <path {...P} d="M15 10v11M7 10v11" />
    </>
  ),
  supa: (
    <>
      <path {...P} d="M4 11h16a8 8 0 0 1-16 0Z" />
      <path {...P} d="M9 4c0 1-1 1-1 2s1 1 1 2M13 4c0 1-1 1-1 2s1 1 1 2" />
    </>
  ),
  sallata: (
    <>
      <path {...P} d="M12 21c5 0 9-4 9-9H3c0 5 4 9 9 9Z" />
      <path {...P} d="M12 12c0-4 2-7 5-8M12 12c-1-3-3-5-6-5" />
    </>
  ),
  kryesore: (
    <>
      <path {...P} d="M6 3v18M4 3v5a2 2 0 0 0 4 0V3" />
      <path {...P} d="M18 3l-3 6h6l-3-6ZM18 9v12" />
    </>
  ),
  pije: (
    <>
      <path {...P} d="M6 4h12l-1.5 9a5 5 0 0 1-9 0L6 4Z" />
      <path {...P} d="M12 18v3M9 21h6" />
    </>
  ),
  embelsira: (
    <>
      <path {...P} d="M5 10h14l-1 10H6L5 10Z" />
      <path {...P} d="M9 10a3 3 0 0 1 6 0" />
      <path {...P} d="M12 4v3" />
    </>
  ),
  pica: (
    <>
      <path {...P} d="M12 3 3 20l9-2 9 2L12 3Z" />
      <path {...P} d="M10 10h.01M13 14h.01" />
    </>
  ),
  other: (
    <>
      <circle {...P} cx="12" cy="12" r="9" />
      <path {...P} d="M8 12h8M12 8v8" />
    </>
  ),
};

export const CATEGORY_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "antipasta", label: "Antipasta" },
  { key: "supa", label: "Supa" },
  { key: "sallata", label: "Sallata" },
  { key: "kryesore", label: "Pjata Kryesore" },
  { key: "pije", label: "Pije" },
  { key: "embelsira", label: "Ëmbëlsira" },
  { key: "pica", label: "Pica" },
  { key: "other", label: "Tjetër" },
];

export function CategoryIcon({
  icon,
  className = "w-5 h-5",
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  const glyph = (icon && ICONS[icon]) || ICONS.other;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {glyph}
    </svg>
  );
}
