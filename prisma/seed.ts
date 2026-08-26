import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@platforma.al").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "SUPER_ADMIN" },
    create: { email, passwordHash, role: "SUPER_ADMIN" },
  });

  console.log(`✔ Super Admin gati: ${admin.email}`);
  console.log(`  Fjalëkalimi: ${password}  (ndrysho në .env para deploy-it)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
