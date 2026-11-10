import Link from "next/link";

/** Shenja e markës mbi formularët e llogarisë (hyrje, regjistrim, onboarding). */
export function AuthBrand() {
  return (
    <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-2 font-display text-xl font-bold text-ink" aria-label="OnlineMenu.al — kryefaqja">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-chef-96.png" alt="" width={44} height={35} className="h-9 w-auto" />
      <span>
        OnlineMenu<span className="text-primary">.al</span>
      </span>
    </Link>
  );
}
