import Link from "next/link";
import { listAudit } from "@/modules/admin/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Audit (vetëm SUPER_ADMIN — guard te admin/layout). Pa sekrete/token; vetëm meta veprimi. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const rid = typeof searchParams.restaurantId === "string" ? searchParams.restaurantId : undefined;
  const action = typeof searchParams.action === "string" ? searchParams.action : undefined;
  const entries = await listAudit({ restaurantId: rid, action, limit: 200 });

  // Emrat e restoranteve (për lexueshmëri), pa ekspozuar të dhëna private.
  const ids = Array.from(new Set(entries.map((e) => e.restaurantId).filter(Boolean))) as string[];
  const names = new Map(
    (await prisma.restaurant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((r) => [r.id, r.name])
  );

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl">Audit</h1>
        {rid && <Link href="/admin/audit" className="text-sm text-muted hover:text-primary">Hiq filtrin</Link>}
      </div>
      <p className="text-sm text-muted">
        Mutacionet administrative dhe ndryshimet kritike të roleve/abonimeve. Pa sekrete apo token.
      </p>

      {entries.length === 0 ? (
        <p className="text-muted">Asnjë regjistrim.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Koha</th>
                <th className="px-4 py-3">Aktori</th>
                <th className="px-4 py-3">Veprimi</th>
                <th className="px-4 py-3">Restoranti</th>
                <th className="px-4 py-3">Përmbledhje</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-b-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{e.createdAt.toLocaleString("sq-AL")}</td>
                  <td className="px-4 py-3">
                    <div className="text-ink">{e.actorEmail ?? "—"}</div>
                    {e.actorRole && <div className="text-xs text-muted">{e.actorRole}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3"><code className="text-xs text-primary">{e.action}</code></td>
                  <td className="px-4 py-3 text-muted">{e.restaurantId ? (names.get(e.restaurantId) ?? e.restaurantId) : "—"}</td>
                  <td className="px-4 py-3 text-muted">{e.summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
