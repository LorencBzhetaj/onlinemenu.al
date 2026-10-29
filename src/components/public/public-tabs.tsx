import Link from "next/link";

type Tab = "profile" | "menu" | "info";

// Navigim i njëtrajtshëm i klientit brenda profilit: Restoranti · Menuja · Informacion.
// (Nuk përzihet me navigimin e panelit/stafit.) Sticky poshtë në telefon, lart në desktop.
export function PublicTabs({
  slug,
  active,
  labels,
}: {
  slug: string;
  active: Tab;
  labels: { profile: string; menu: string; info: string };
}) {
  const base = `/restaurants/${slug}`;
  const items: { key: Tab; href: string; label: string; icon: React.ReactNode }[] = [
    {
      key: "profile",
      href: base,
      label: labels.profile,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      ),
    },
    {
      key: "menu",
      href: `${base}/menu`,
      label: labels.menu,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M4 5h16M4 12h16M4 19h10" />
        </svg>
      ),
    },
    {
      key: "info",
      href: `${base}/info`,
      label: labels.info,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="rpub-tabs" aria-label="Navigim">
      {items.map((it) => (
        <Link key={it.key} href={it.href} className={it.key === active ? "active" : ""} aria-current={it.key === active ? "page" : undefined}>
          {it.icon}
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
