import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signInMethods } from "@/modules/accounts/oauth";
import { OmSiteHeader } from "@/components/public/om-site-header";
import { AccountLinking } from "./account-linking";
import "@/components/public/om-public.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Llogaria ime", robots: { index: false, follow: false } };

const LINK_MESSAGES: Record<string, string> = {
  link_conflict: "Ky identitet është i lidhur tashmë me një llogari tjetër. Nuk u lidh.",
  missing_email: "Ofruesi nuk dha email; lidhja nuk u përfundua.",
  email_unverified: "Ofruesi nuk e konfirmoi email-in; lidhja nuk u përfundua.",
  account_exists: "Lidhja nuk u përfundua. Provoni përsëri nga kjo faqe.",
};

export default async function AccountPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, methods] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerified: true,
        role: true,
        memberships: { where: { status: "active" }, select: { role: true, restaurant: { select: { id: true, name: true } } } },
      },
    }),
    signInMethods(userId),
  ]);
  if (!user) redirect("/login");

  const configured = authOptions.providers.map((p) => p.id).filter((id) => id === "google" || id === "apple");
  const linked = methods.oauth.map((o) => o.provider);
  const linkMsg = typeof searchParams.link === "string" ? LINK_MESSAGES[searchParams.link] : null;
  const linkedOk = typeof searchParams.linked === "string";

  return (
    <div className="min-h-screen bg-om-white font-om-body text-om-aubergine">
      <OmSiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <h1 className="font-om-display text-3xl font-bold">Llogaria ime</h1>
        <p className="mt-1 text-om-ink-soft">
          {user.email} · {user.emailVerified ? "email i verifikuar" : "email i paverifikuar"}
        </p>

        {linkedOk && <p className="mt-4 rounded-2xl border border-om-line bg-om-butter-soft p-3 font-bold" role="status">Mënyra e re e hyrjes u lidh me këtë llogari.</p>}
        {linkMsg && <p className="mt-4 rounded-2xl border border-om-pink bg-om-pink-soft p-3 font-bold" role="alert">{linkMsg}</p>}

        <section className="mt-6 rounded-3xl border border-om-line bg-om-surface p-5" aria-labelledby="h-metodat">
          <h2 id="h-metodat" className="font-om-display text-xl font-semibold">Mënyrat e hyrjes</h2>
          <ul className="mt-3 divide-y divide-om-line">
            <li className="flex items-center justify-between py-3">
              <span className="font-bold">Email dhe fjalëkalim</span>
              <span className="text-sm text-om-ink-soft">{methods.hasPassword ? "Aktiv" : "Pa fjalëkalim"}</span>
            </li>
            {configured.map((p) => (
              <li key={p} className="flex items-center justify-between py-3">
                <span className="font-bold">{p === "google" ? "Google" : "Apple"}</span>
                <span className="text-sm text-om-ink-soft">{linked.includes(p as "google" | "apple") ? "I lidhur" : "Jo i lidhur"}</span>
              </li>
            ))}
          </ul>
          <AccountLinking
            hasPassword={methods.hasPassword}
            verified={user.emailVerified}
            available={configured.filter((p) => !linked.includes(p as "google" | "apple")) as ("google" | "apple")[]}
          />
        </section>

        <section className="mt-6 rounded-3xl border border-om-line bg-om-surface p-5" aria-labelledby="h-biznesi">
          <h2 id="h-biznesi" className="font-om-display text-xl font-semibold">Bizneset</h2>
          {user.memberships.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {user.memberships.map((m) => (
                <li key={m.restaurant.id} className="flex items-center justify-between gap-3">
                  <span className="font-bold">{m.restaurant.name}</span>
                  <Link href={`/dashboard?r=${m.restaurant.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-om-aubergine px-4 text-sm font-extrabold text-white">
                    Paneli
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2">
              <p className="text-om-ink-soft">
                Kjo llogari s’ka biznes. Menutë dhe rezervimet si vizitor s’kërkojnë biznes.
              </p>
              {user.role !== "SUPER_ADMIN" &&
                (user.emailVerified ? (
                  <Link href="/onboarding" className="mt-3 inline-flex min-h-12 items-center rounded-2xl bg-om-butter px-5 font-extrabold text-om-aubergine">
                    Regjistro biznesin
                  </Link>
                ) : (
                  <p className="mt-3 font-bold">Verifikoni email-in para se të regjistroni biznesin.</p>
                ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
