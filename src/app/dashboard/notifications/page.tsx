import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { NotificationsClient } from "./notifications-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const access = await pageAccess("booking:config", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;
  return <NotificationsClient />;
}
