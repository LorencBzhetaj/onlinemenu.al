import { NextResponse } from "next/server";
import { guardRestaurant } from "@/modules/memberships/access";
import { listTeam } from "@/modules/memberships/invitations";

export const dynamic = "force-dynamic";

/** Lista e ekipit (anëtarë + ftesa pending) e këtij restoranti. team:read (OWNER). */
export async function GET(req: Request) {
  const g = await guardRestaurant(req, "team:read");
  if ("error" in g) return g.error;
  const data = await listTeam(g.ctx.restaurantId, g.ctx.userId);
  return NextResponse.json(data);
}
