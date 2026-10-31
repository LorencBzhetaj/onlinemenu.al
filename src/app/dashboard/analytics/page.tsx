import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { getAnalyticsSummary } from "@/modules/analytics/events";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("analytics:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;

  const s = await getAnalyticsSummary(access.ctx.restaurantId, 30);

  return (
    <div>
      <PageHeader title="Analitika" subtitle={`Aktiviteti i ${s.days} ditëve të fundit (të dhëna reale, pa të dhëna personale).`} />

      {s.total === 0 ? (
        <EmptyState title="Ende pa aktivitet">
          Kur klientët hapin profilin, menunë ose rezervojnë, statistikat shfaqen këtu. Siguro që restoranti të jetë i publikuar dhe QR-ja në përdorim.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Shikime profili" value={s.totals.profile_view} />
            <StatCard label="Shikime menuje" value={s.totals.menu_view} />
            <StatCard label="Klikime pjatash" value={s.totals.item_view} />
            <StatCard label="Klikime Wolt" value={s.totals.wolt_click} hint="Lidhje e jashtme — jo porosi/rezervime" />
            <StatCard label="Rezervime" value={s.totals.booking_created} />
          </div>

          <h2 className="mb-3 mt-8 font-display text-lg text-ink">Pjatat më të klikuara</h2>
          {s.topItems.length === 0 ? (
            <p className="text-sm text-muted">Ende pa klikime mbi pjata.</p>
          ) : (
            <div className="overflow-hidden rounded-card-sm border border-line bg-surface shadow-card">
              {s.topItems.map((it, i) => (
                <div key={it.itemId} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0">
                  <span className="min-w-0 truncate text-sm text-ink"><span className="mr-2 text-muted">{i + 1}.</span>{it.name}</span>
                  <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">{it.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
