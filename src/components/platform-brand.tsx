import Link from "next/link";

/** Shenja e markës për panelin dhe admin-in: logoja + "OnlineMenu.al" + etiketë e zonës. */
export function PlatformBrand({ area, href = "/" }: { area: "Paneli" | "Admin"; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-display text-lg font-bold text-ink lg:mb-6" aria-label={`OnlineMenu.al — ${area}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-chef-96.png" alt="" width={36} height={29} className="h-7 w-auto" />
      <span>
        OnlineMenu<span className="text-primary">.al</span>
      </span>
      <span className="rounded-full bg-primary-soft px-2 py-0.5 font-ui text-xs font-bold text-ink">{area}</span>
    </Link>
  );
}
