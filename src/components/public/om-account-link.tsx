"use client";

// Lidhja dytësore e header-it publik: "Hyr" për vizitorin, "Llogaria ime" për përdoruesin e kyçur.
// Lexon sesionin në klient, që faqet publike të mbeten statike/të kesh-uara.
import Link from "next/link";
import { useSession } from "next-auth/react";

export function OmAccountLink({ signedIn = false }: { signedIn?: boolean }) {
  const { status } = useSession();
  const isIn = signedIn || status === "authenticated";
  return (
    <Link href={isIn ? "/account" : "/login"} className="om-site-secondary">
      {isIn ? "Llogaria ime" : "Hyr"}
    </Link>
  );
}
