import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvitationByToken } from "@/modules/memberships/invitations";
import { AcceptInvite } from "./accept-invite";

export const dynamic = "force-dynamic";
// Ftesa mban token → nuk indeksohet.
export const metadata: Metadata = { title: "Ftesë në ekip", robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, string> = { MANAGER: "Menaxher", STAFF: "Staf" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">{children}</div>
    </main>
  );
}

export default async function InvitePage({ params }: { params: { token: string } }) {
  const inv = await getInvitationByToken(params.token);

  if (!inv) {
    return <Shell><h1 className="font-display text-2xl">Ftesa nuk u gjet</h1><p className="mt-2 text-muted">Lidhja nuk është e vlefshme.</p></Shell>;
  }
  if (inv.status === "accepted") {
    return <Shell><h1 className="font-display text-2xl">Ftesa është përdorur</h1><p className="mt-2 text-muted">Kjo ftesë është pranuar tashmë.</p></Shell>;
  }
  if (inv.status === "revoked") {
    return <Shell><h1 className="font-display text-2xl">Ftesa u anulua</h1><p className="mt-2 text-muted">Kjo ftesë nuk është më aktive.</p></Shell>;
  }
  if (inv.expired) {
    return <Shell><h1 className="font-display text-2xl">Ftesa ka skaduar</h1><p className="mt-2 text-muted">Kërko pronarit një ftesë të re.</p></Shell>;
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    const cb = encodeURIComponent(`/invite/${params.token}`);
    return (
      <Shell>
        <h1 className="font-display text-2xl">Ftesë te {inv.restaurantName}</h1>
        <p className="mt-2 text-muted">Je ftuar si <strong>{ROLE_LABEL[inv.role] ?? inv.role}</strong> për <strong>{inv.email}</strong>.</p>
        <p className="mt-4 text-sm text-muted">Hyr ose regjistrohu me këtë email për ta pranuar.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/login?callbackUrl=${cb}`} className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-white hover:bg-primary-dark">Hyr</Link>
          <Link href={`/register?callbackUrl=${cb}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-6 text-sm text-ink hover:border-primary/50">Regjistrohu</Link>
        </div>
      </Shell>
    );
  }

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const emailMatches = (me?.email ?? "").toLowerCase() === inv.email.toLowerCase();

  return (
    <Shell>
      <h1 className="font-display text-2xl">Ftesë te {inv.restaurantName}</h1>
      <p className="mt-2 text-muted">Rol: <strong>{ROLE_LABEL[inv.role] ?? inv.role}</strong></p>
      {emailMatches ? (
        <AcceptInvite token={params.token} restaurantName={inv.restaurantName} />
      ) : (
        <p className="mt-4 text-sm text-red-600">
          Kjo ftesë është për <strong>{inv.email}</strong>, por je kyçur si <strong>{me?.email}</strong>. Dil dhe hyr me email-in e ftesës.
        </p>
      )}
    </Shell>
  );
}
