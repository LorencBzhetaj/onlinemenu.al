import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/modules/admin/audit";

/**
 * Ekipi (Faza 7) — ftesa me skadim dhe përdorim të vetëm, pranim, role MANAGER/STAFF
 * dhe revokim. Ruan invariantin e OWNER (ftesat s'krijojnë kurrë OWNER; revokimi s'lejon
 * mbetjen pa OWNER aktiv) dhe izolimin tenant (çdo veprim lidhet me një restaurantId).
 */

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ditë
export type InvitableRole = "MANAGER" | "STAFF";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isInvitableRole(x: unknown): x is InvitableRole {
  return x === "MANAGER" || x === "STAFF";
}

export type InviteResult =
  | { ok: true; token: string; invitationId: string }
  | { ok: false; error: "bad_role" | "bad_email" | "already_member" | "already_invited" };

/**
 * Krijon një ftesë. VETËM OWNER (kontrolli i lejes bëhet te route-i me `team:write`).
 * Roli lejohet vetëm MANAGER/STAFF. Tokeni kthehet RAW një herë (për linkun); në DB ruhet
 * vetëm SHA-256. Nëse email-i është tashmë anëtar aktiv → refuzohet.
 */
export async function createInvitation(params: {
  restaurantId: string;
  email: string;
  role: string;
  invitedByUserId: string;
  invitedByEmail?: string | null;
}): Promise<InviteResult> {
  const email = params.email.trim().toLowerCase();
  if (!isInvitableRole(params.role)) return { ok: false, error: "bad_role" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "bad_email" };

  // A është tashmë anëtar aktiv i KËTIJ restoranti?
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const m = await prisma.restaurantMembership.findUnique({
      where: { userId_restaurantId: { userId: existingUser.id, restaurantId: params.restaurantId } },
      select: { status: true },
    });
    if (m && m.status === "active") return { ok: false, error: "already_member" };
  }

  // Një ftesë aktive (pending jo e skaduar) për të njëjtin email+restorant → riciklo (revoko të vjetrën).
  await prisma.invitation.updateMany({
    where: { restaurantId: params.restaurantId, email, status: "pending" },
    data: { status: "revoked" },
  });

  const token = randomBytes(32).toString("hex");
  const inv = await prisma.invitation.create({
    data: {
      restaurantId: params.restaurantId,
      email,
      role: params.role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      invitedByUserId: params.invitedByUserId,
    },
    select: { id: true },
  });

  await recordAudit({
    actorUserId: params.invitedByUserId,
    actorEmail: params.invitedByEmail ?? null,
    actorRole: "OWNER",
    restaurantId: params.restaurantId,
    action: "team.invite",
    targetType: "Invitation",
    targetId: inv.id,
    summary: `Ftesë ${params.role} për ${email}`,
  });

  return { ok: true, token, invitationId: inv.id };
}

export type InvitationView = {
  id: string;
  email: string;
  role: string;
  restaurantId: string;
  restaurantName: string;
  status: string;
  expired: boolean;
};

/** Lexon një ftesë nga tokeni RAW (hash-im + lookup). Kthen null nëse s'ekziston. */
export async function getInvitationByToken(token: string): Promise<InvitationView | null> {
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, email: true, role: true, restaurantId: true, status: true, expiresAt: true, restaurant: { select: { name: true } } },
  });
  if (!inv) return null;
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    restaurantId: inv.restaurantId,
    restaurantName: inv.restaurant.name,
    status: inv.status,
    expired: inv.expiresAt.getTime() <= Date.now(),
  };
}

export type AcceptResult =
  | { ok: true; restaurantId: string; role: string }
  | { ok: false; error: "not_found" | "expired" | "used" | "revoked" | "email_mismatch" };

/**
 * Pranon një ftesë për user-in e kyçur. ATOMIK dhe NJËPËRDORIMËSH: brenda një transaksioni
 * ri-lexon ftesën me `status:pending` dhe e kalon në `accepted` me `updateMany` të guard-uar
 * (count===1 → fituesi); dy pranime paralele → vetëm njëri kalon. Email-i i user-it duhet të
 * përputhet me email-in e ftesës (case-insensitive). Krijon ose riaktivizon membership-in.
 */
export async function acceptInvitation(params: { token: string; userId: string; userEmail: string }): Promise<AcceptResult> {
  const tokenHash = hashToken(params.token);
  const userEmail = params.userEmail.trim().toLowerCase();

  return prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUnique({
      where: { tokenHash },
      select: { id: true, email: true, role: true, restaurantId: true, status: true, expiresAt: true },
    });
    if (!inv) return { ok: false, error: "not_found" as const };
    if (inv.status === "revoked") return { ok: false, error: "revoked" as const };
    if (inv.status === "accepted") return { ok: false, error: "used" as const };
    if (inv.expiresAt.getTime() <= Date.now()) return { ok: false, error: "expired" as const };
    if (inv.email.toLowerCase() !== userEmail) return { ok: false, error: "email_mismatch" as const };

    // Konsumim njëpërdorimësh i guard-uar (pending → accepted). Garë → vetëm një fiton.
    const consumed = await tx.invitation.updateMany({
      where: { id: inv.id, status: "pending" },
      data: { status: "accepted", acceptedByUserId: params.userId, acceptedAt: new Date() },
    });
    if (consumed.count !== 1) return { ok: false, error: "used" as const };

    // Krijo ose riaktivizo membership-in me rolin e ftesës (kurrë s'ul një OWNER ekzistues).
    const existing = await tx.restaurantMembership.findUnique({
      where: { userId_restaurantId: { userId: params.userId, restaurantId: inv.restaurantId } },
      select: { role: true },
    });
    if (existing?.role === "OWNER") {
      // Tashmë OWNER → mban OWNER (ftesa s'e ul); vetëm sigurohet aktiv.
      await tx.restaurantMembership.update({
        where: { userId_restaurantId: { userId: params.userId, restaurantId: inv.restaurantId } },
        data: { status: "active" },
      });
    } else {
      await tx.restaurantMembership.upsert({
        where: { userId_restaurantId: { userId: params.userId, restaurantId: inv.restaurantId } },
        update: { role: inv.role, status: "active" },
        create: { userId: params.userId, restaurantId: inv.restaurantId, role: inv.role, status: "active" },
      });
    }

    await recordAudit(
      {
        actorUserId: params.userId,
        actorEmail: userEmail,
        actorRole: inv.role,
        restaurantId: inv.restaurantId,
        action: "team.accept",
        targetType: "Membership",
        targetId: params.userId,
        summary: `Pranoi ftesën si ${inv.role}`,
      },
      tx
    );

    return { ok: true, restaurantId: inv.restaurantId, role: inv.role };
  });
}

export type TeamMember = {
  userId: string;
  email: string;
  role: string;
  status: string;
  isSelf: boolean;
};

export type PendingInvite = { id: string; email: string; role: string; expiresAt: Date; expired: boolean };

export async function listTeam(restaurantId: string, selfUserId: string): Promise<{ members: TeamMember[]; invitations: PendingInvite[] }> {
  const [memberships, invites] = await Promise.all([
    prisma.restaurantMembership.findMany({
      where: { restaurantId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { userId: true, role: true, status: true, user: { select: { email: true } } },
    }),
    prisma.invitation.findMany({
      where: { restaurantId, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  ]);
  return {
    members: memberships.map((m) => ({ userId: m.userId, email: m.user.email, role: m.role, status: m.status, isSelf: m.userId === selfUserId })),
    invitations: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, expired: i.expiresAt.getTime() <= Date.now() })),
  };
}

export type RevokeResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "last_owner" | "cannot_revoke_owner" };

/**
 * Revokon anëtarësimin e një përdoruesi (status → revoked). INVARIANTI I OWNER:
 *  - OWNER-i nuk revokohet nga ky rrjedhë (pronari kanonik mbrohet).
 *  - Edhe përndryshe, s'lejohet të mbetet restoranti pa asnjë OWNER aktiv.
 * VETËM OWNER (leja `team:write`). Izolim tenant: vepron vetëm brenda restaurantId.
 */
export async function revokeMembership(params: {
  restaurantId: string;
  targetUserId: string;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<RevokeResult> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.restaurantMembership.findUnique({
      where: { userId_restaurantId: { userId: params.targetUserId, restaurantId: params.restaurantId } },
      select: { role: true, status: true, user: { select: { email: true } } },
    });
    if (!target) return { ok: false, error: "not_found" as const };
    // OWNER-i kanonik s'revokohet nga menaxhimi i ekipit (invariant).
    if (target.role === "OWNER") return { ok: false, error: "cannot_revoke_owner" as const };

    await tx.restaurantMembership.update({
      where: { userId_restaurantId: { userId: params.targetUserId, restaurantId: params.restaurantId } },
      data: { status: "revoked" },
    });

    // Siguri shtesë: duhet të mbetet të paktën një OWNER aktiv.
    const owners = await tx.restaurantMembership.count({ where: { restaurantId: params.restaurantId, role: "OWNER", status: "active" } });
    if (owners < 1) throw new Error("owner_invariant_violation");

    await recordAudit(
      {
        actorUserId: params.actorUserId,
        actorEmail: params.actorEmail ?? null,
        actorRole: "OWNER",
        restaurantId: params.restaurantId,
        action: "team.revoke",
        targetType: "Membership",
        targetId: params.targetUserId,
        summary: `Revokoi ${target.role} (${target.user.email})`,
      },
      tx
    );

    return { ok: true as const };
  });
}

/** Revokon një ftesë pending (pa prekur anëtarësimet). VETËM OWNER. */
export async function revokeInvitation(params: { restaurantId: string; invitationId: string; actorUserId: string; actorEmail?: string | null }): Promise<boolean> {
  const res = await prisma.invitation.updateMany({
    where: { id: params.invitationId, restaurantId: params.restaurantId, status: "pending" },
    data: { status: "revoked" },
  });
  if (res.count === 1) {
    await recordAudit({
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail ?? null,
      actorRole: "OWNER",
      restaurantId: params.restaurantId,
      action: "team.invite_revoke",
      targetType: "Invitation",
      targetId: params.invitationId,
      summary: "Revokoi një ftesë pending",
    });
  }
  return res.count === 1;
}
