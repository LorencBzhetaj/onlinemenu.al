import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { daysUntil } from "@/lib/subscription";
import { SubscriptionForm } from "./subscription-form";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantDetail({
  params,
}: {
  params: { id: string };
}) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: params.id },
    include: {
      subscription: true,
      owner: { select: { email: true } },
      _count: { select: { categories: true, tastingMenus: true } },
    },
  });

  if (!restaurant) notFound();

  const sub = restaurant.subscription;
  const expiresAt = sub ? new Date(sub.expiresAt) : null;
  const days = expiresAt ? daysUntil(expiresAt) : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/admin/restaurants" className="text-sm text-muted hover:text-primary">
        ← Të gjitha restorantet
      </Link>

      <div>
        <h1 className="font-heading text-3xl">{restaurant.name}</h1>
        <p className="text-muted mt-1">{restaurant.owner.email}</p>
      </div>

      {/* Përmbledhje (vetëm-lexim) */}
      <div className="rounded-lg border border-line bg-surface p-5 space-y-2">
        <Row label="Slug" value={restaurant.slug} />
        <Row label="Email pronari" value={restaurant.owner.email} />
        <Row label="Regjistruar më" value={new Date(restaurant.createdAt).toLocaleDateString("sq-AL")} />
        <Row label="Publikuar" value={restaurant.isPublished ? "Po" : "Jo"} />
        <Row label="Kategori" value={String(restaurant._count.categories)} />
        <Row label="Menu degustuese" value={String(restaurant._count.tastingMenus)} />
      </div>

      {/* Statusi aktual i abonimit */}
      <div className="rounded-lg border border-line bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg">Abonimi</h2>
          <StatusBadge status={sub?.status ?? "—"} />
        </div>
        {sub ? (
          <>
            <Row label="Plani" value={sub.plan} />
            <Row label="Skadon më" value={expiresAt!.toLocaleDateString("sq-AL")} />
            <Row
              label="Kohëzgjatja"
              value={
                days === null
                  ? "—"
                  : days >= 0
                    ? `${days} ditë të mbetura`
                    : `Skaduar prej ${Math.abs(days)} ditësh`
              }
            />
            {sub.lastPaymentNote && <Row label="Shënim pagese" value={sub.lastPaymentNote} />}
          </>
        ) : (
          <p className="text-muted">Pa abonim.</p>
        )}
      </div>

      {/* Veprimet e abonimit */}
      <div className="rounded-lg border border-primary/40 bg-surface p-5 space-y-4">
        <h2 className="font-heading text-lg text-primary">Menaxho Abonimin</h2>
        <SubscriptionForm
          restaurantId={restaurant.id}
          initial={{
            status: sub?.status ?? "trial",
            plan: sub?.plan ?? "monthly",
            lastPaymentNote: sub?.lastPaymentNote ?? null,
          }}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted shrink-0">{label}</span>
      <span className="capitalize text-right break-words">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "text-green-700 border-green-400/40 bg-green-50"
      : status === "trial"
        ? "text-primary border-primary/40 bg-primary/10"
        : status === "expired"
          ? "text-red-600 border-red-400/40 bg-red-400/10"
          : status === "cancelled"
            ? "text-muted border-line bg-black/5"
            : "text-muted border-line";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs capitalize ${color}`}>
      {status}
    </span>
  );
}
