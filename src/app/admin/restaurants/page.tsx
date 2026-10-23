import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/table";

type Row = {
  id: string;
  name: string;
  slug: string;
  owner: { email: string };
  subscription: { status: string; expiresAt: Date } | null;
};

export default async function AdminRestaurantsPage() {
  const restaurants = await prisma.restaurant.findMany({
    include: { subscription: true, owner: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const columns: Column<Row>[] = [
    { key: "name", header: "Restoranti", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "owner", header: "Pronari", render: (r) => <span className="text-muted">{r.owner.email}</span> },
    { key: "slug", header: "Slug", hideOnMobile: true, render: (r) => <span className="text-muted">{r.slug}</span> },
    { key: "sub", header: "Abonimi", render: (r) => <StatusBadge status={r.subscription?.status ?? "—"} /> },
    {
      key: "exp",
      header: "Skadon",
      hideOnMobile: true,
      render: (r) => (r.subscription ? new Date(r.subscription.expiresAt).toLocaleDateString("sq-AL") : "—"),
    },
    {
      key: "act",
      header: "",
      render: (r) => (
        <Link href={`/admin/restaurants/${r.id}`} className="font-medium text-primary hover:underline">
          Detaje
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Restorantet"
        subtitle={`${restaurants.length} restorant${restaurants.length === 1 ? "" : "e"} gjithsej`}
      />
      <DataTable columns={columns} rows={restaurants as Row[]} rowKey={(r) => r.id} emptyTitle="Ende s'ka restorante të regjistruar." />
    </div>
  );
}
