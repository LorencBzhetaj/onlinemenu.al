import { prisma } from "@/lib/prisma";
import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // billing:read → vetëm OWNER (STAFF/MANAGER refuzohen).
  const access = await pageAccess("billing:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;
  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId: access.ctx.restaurantId },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl">Abonimi</h1>

      {subscription ? (
        <div className="rounded-lg border border-line bg-surface p-5 space-y-2 max-w-md">
          <Row label="Plani" value={subscription.plan} />
          <Row label="Statusi" value={subscription.status} />
          <Row
            label="Skadon më"
            value={new Date(subscription.expiresAt).toLocaleDateString("sq-AL")}
          />
        </div>
      ) : (
        <p className="text-muted">Nuk u gjet abonim.</p>
      )}

      <div className="rounded-lg border border-primary/40 bg-surface p-5 max-w-md">
        <p className="text-muted text-sm mb-3">
          Rinovimi bëhet manualisht (pa Stripe në fillim). Na kontakto në WhatsApp
          për të rinovuar abonimin.
        </p>
        <a
          href="https://wa.me/"
          className="inline-block rounded-full bg-primary px-5 py-2 text-white font-medium hover:opacity-90 transition"
        >
          Rinovo via WhatsApp
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="capitalize">{value}</span>
    </div>
  );
}
