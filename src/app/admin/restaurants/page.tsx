import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminRestaurantsPage() {
  const restaurants = await prisma.restaurant.findMany({
    include: { subscription: true, owner: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Restorantet</h1>
        <p className="text-alpine-cream/60 mt-1">
          {restaurants.length} restorant{restaurants.length === 1 ? "" : "e"} gjithsej
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-alpine-cream/10">
        <table className="w-full text-sm">
          <thead className="bg-midnight-soft text-alpine-cream/60 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Restoranti</th>
              <th className="px-4 py-3 font-medium">Pronari</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Abonimi</th>
              <th className="px-4 py-3 font-medium">Skadon</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {restaurants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-alpine-cream/50">
                  Ende s&apos;ka restorante të regjistruar.
                </td>
              </tr>
            )}
            {restaurants.map((r) => (
              <tr key={r.id} className="border-t border-alpine-cream/10">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 text-alpine-cream/70">{r.owner.email}</td>
                <td className="px-4 py-3 text-alpine-cream/70">{r.slug}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.subscription?.status ?? "—"} />
                </td>
                <td className="px-4 py-3 text-alpine-cream/70">
                  {r.subscription
                    ? new Date(r.subscription.expiresAt).toLocaleDateString("sq-AL")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/restaurants/${r.id}`}
                    className="text-alpine-gold hover:underline"
                  >
                    Detaje
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "text-green-400 border-green-400/40"
      : status === "trial"
        ? "text-alpine-gold border-alpine-gold/40"
        : status === "expired"
          ? "text-red-400 border-red-400/40"
          : "text-alpine-cream/50 border-alpine-cream/20";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${color}`}>
      {status}
    </span>
  );
}
