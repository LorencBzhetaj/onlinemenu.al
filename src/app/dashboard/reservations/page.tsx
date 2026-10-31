import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { hasEntitlement } from "@/modules/subscriptions/entitlements";
import { DashboardNotice } from "@/components/dashboard-notice";
import { Notice } from "@/components/ui/states";
import { ReservationsClient } from "./reservations-client";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const access = await pageAccess("reservations:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;

  const bookingActive = await hasEntitlement(access.ctx.restaurantId, "BOOKING");
  if (!bookingActive) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink mb-3">Rezervime</h1>
        <Notice>Moduli i rezervimeve (BOOKING) nuk është aktiv për këtë restorant. Kontaktoni administratorin për ta aktivizuar.</Notice>
      </div>
    );
  }

  // reservations:write i lejohet çdo roli (OWNER/MANAGER/STAFF).
  return <ReservationsClient />;
}
