import { pageAccess, restaurantIdFromSearchParams } from "@/modules/memberships/access";
import { DashboardNotice } from "@/components/dashboard-notice";
import { TeamClient } from "./team-client";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // team:read → vetëm OWNER (MANAGER/STAFF refuzohen).
  const access = await pageAccess("team:read", restaurantIdFromSearchParams(searchParams));
  if (!access.ok) return <DashboardNotice reason={access.reason} />;
  return <TeamClient />;
}
