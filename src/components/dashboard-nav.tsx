"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Përmbledhje" },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/tasting-menus", label: "Menu Degustuese" },
  { href: "/dashboard/links", label: "Lidhje" },
  { href: "/dashboard/reservations", label: "Rezervime" },
  { href: "/dashboard/customers", label: "Klientët" },
  { href: "/dashboard/tables", label: "Salla" },
  { href: "/dashboard/hours", label: "Orari" },
  { href: "/dashboard/notifications", label: "Njoftime" },
  { href: "/dashboard/branding", label: "Personalizim" },
  { href: "/dashboard/qr", label: "QR Kod" },
  { href: "/dashboard/analytics", label: "Analitika" },
  { href: "/dashboard/team", label: "Ekipi" },
  { href: "/dashboard/settings", label: "Cilësime" },
  { href: "/dashboard/billing", label: "Abonimi" },
];

// Navigimi ruan ?r (restorantin e këtij tab-i), që pin-i të mbijetojë lëvizjen mes faqeve.
export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const r = useSearchParams().get("r");
  const suffix = r ? `?r=${encodeURIComponent(r)}` : "";
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 text-sm lg:mt-6 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={`${item.href}${suffix}`}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3.5 py-2 transition lg:rounded-xl ${
            isActive(item.href)
              ? "bg-primary-soft font-medium text-primary"
              : "text-muted hover:bg-black/[0.04] hover:text-ink"
          }`}
        >
          {item.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin"
          className="whitespace-nowrap rounded-full px-3.5 py-2 text-primary transition hover:bg-black/[0.04] lg:hidden"
        >
          → Admin
        </Link>
      )}
    </nav>
  );
}
