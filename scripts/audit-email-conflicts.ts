/*
 * Auditim VETËM-LEXIM i konflikteve të email-it para indeksit unik mbi lower(email).
 * Raporton grupet e llogarive që ndryshojnë vetëm në shkronja të mëdha/vogla ose në hapësira.
 * NUK bashkon, NUK fshin dhe NUK ndryshon asgjë. Nuk printon email-e të plota (vetëm maskuar).
 *
 * Përdorim: DATABASE_URL=... npx tsx scripts/audit-email-conflicts.ts
 * Dalja: 0 = pa konflikte; 3 = ka konflikte (zgjidhen manualisht para migrimit).
 */
import { prisma } from "@/lib/prisma";

export function maskEmail(e: string): string {
  const [local, domain = ""] = e.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function findEmailConflicts(): Promise<{ key: string; users: { id: string; email: string; verified: boolean; createdAt: Date }[] }[]> {
  const users = await prisma.user.findMany({ select: { id: true, email: true, emailVerified: true, createdAt: true } });
  const groups = new Map<string, { id: string; email: string; verified: boolean; createdAt: Date }[]>();
  for (const u of users) {
    const key = u.email.trim().toLowerCase();
    const list = groups.get(key) ?? [];
    list.push({ id: u.id, email: u.email, verified: u.emailVerified, createdAt: u.createdAt });
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, users: list }));
}

if (require.main === module) {
  findEmailConflicts()
    .then(async (conflicts) => {
      if (conflicts.length === 0) {
        console.log("✓ Asnjë konflikt email-i (lower/trim). Indeksi unik mund të aplikohet.");
        await prisma.$disconnect();
        process.exit(0);
      }
      console.log(`⚠ ${conflicts.length} grup(e) konfliktesh — zgjidhini manualisht (pa bashkim automatik):`);
      for (const c of conflicts) {
        console.log(`  ${maskEmail(c.key)}: ${c.users.map((u) => `${u.id} (${u.verified ? "verifikuar" : "jo i verifikuar"}, ${u.createdAt.toISOString().slice(0, 10)})`).join(" | ")}`);
      }
      await prisma.$disconnect();
      process.exit(3);
    })
    .catch(async (e) => {
      console.error("audit error", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
