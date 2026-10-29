import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Gjeneron një kod QR opak, URL-safe (pa viza), i pandryshueshëm. */
export function generateQrCode(): string {
  return randomBytes(12).toString("hex"); // 24 karaktere hex, entropi e lartë
}

/**
 * Siguron që restoranti ka një kod QR (idempotent). Thirret në provisionim dhe si
 * fallback për restorante të vjetra. Mund të thirret brenda një tx-je.
 */
export async function ensureQrCode(
  client: Prisma.TransactionClient | typeof prisma,
  restaurantId: string
): Promise<string> {
  const existing = await client.qrCode.findUnique({
    where: { restaurantId },
    select: { code: true },
  });
  if (existing) return existing.code;
  const created = await client.qrCode.create({
    data: { code: generateQrCode(), restaurantId },
    select: { code: true },
  });
  return created.code;
}

/**
 * Zgjidh një kod QR → restoranti përkatës. Resolver kontrollon vetëm ekzistencën;
 * publikimi/pezullimi kontrollohet te faqja e profilit. Kthen null nëse s'ekziston.
 */
export async function resolveQrCode(
  code: string
): Promise<{ slug: string } | null> {
  const row = await prisma.qrCode.findUnique({
    where: { code },
    select: { restaurant: { select: { slug: true } } },
  });
  return row ? { slug: row.restaurant.slug } : null;
}
