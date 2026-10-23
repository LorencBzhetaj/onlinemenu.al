"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Përmbledhje" },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/tasting-menus", label: "Menu Degustuese" },
  { href: "/dashboard/branding", label: "Personalizim" },
  { href: "/dashboard/qr", label: "QR Kod" },
  { href: "/dashboard/analytics", label: "Analitika" },
  { href: "/dashboard/settings", label: "Cilësime" },
  { href: "/dashboard/billing", label: "Abonimi" },
];

// Navigimi ruan ?r (restorantin e këtij tab-i), që pin-i të mbijetojë lëvizjen mes faqeve.
export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const r = useSearchParams().get("r");
  const suffix = r ? `?r=${encodeURIComponent(r)}` : "";
  return (
    <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 text-sm lg:mt-0 lg:flex-col lg:overflow-visible lg:pb-0">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={`${item.href}${suffix}`}
          className="whitespace-nowrap rounded-md px-3 py-2 hover:bg-midnight-soft transition"
        >
          {item.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin"
          className="whitespace-nowrap rounded-md px-3 py-2 text-alpine-gold hover:bg-midnight-soft transition lg:hidden"
        >
          → Admin
        </Link>
      )}
    </nav>
  );
}
