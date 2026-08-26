import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  const subscription = session?.user.restaurantId
    ? await prisma.subscription.findUnique({
        where: { restaurantId: session.user.restaurantId },
      })
    : null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl">Abonimi</h1>

      {subscription ? (
        <div className="rounded-lg border border-alpine-cream/10 bg-midnight-soft p-5 space-y-2 max-w-md">
          <Row label="Plani" value={subscription.plan} />
          <Row label="Statusi" value={subscription.status} />
          <Row
            label="Skadon më"
            value={new Date(subscription.expiresAt).toLocaleDateString("sq-AL")}
          />
        </div>
      ) : (
        <p className="text-alpine-cream/70">Nuk u gjet abonim.</p>
      )}

      <div className="rounded-lg border border-alpine-gold/30 bg-midnight-soft p-5 max-w-md">
        <p className="text-alpine-cream/80 text-sm mb-3">
          Rinovimi bëhet manualisht (pa Stripe në fillim). Na kontakto në WhatsApp
          për të rinovuar abonimin.
        </p>
        <a
          href="https://wa.me/"
          className="inline-block rounded-full bg-alpine-gold px-5 py-2 text-midnight font-medium hover:opacity-90 transition"
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
      <span className="text-alpine-cream/50">{label}</span>
      <span className="capitalize">{value}</span>
    </div>
  );
}
