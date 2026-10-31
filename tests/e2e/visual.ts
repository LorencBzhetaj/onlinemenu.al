/* Kontroll vizual Faza 2: screenshots + overflow horizontal në 390px dhe 1440px. */
import { prisma } from "@/lib/prisma";
import { createRestaurantForOwner } from "@/modules/restaurants/provision";
import bcrypt from "bcryptjs";
import { mkdirSync } from "fs";
import { launchBrowser } from "./_browser";

const BASE = "http://localhost:3000";
const SHOT = "/tmp/claude-0/-home-user-onlinemenu-al/0d9e83e4-f355-5b98-bff3-f83d225b57b6/scratchpad/shots2";
const PW = "password123";
const SUF = "@vis.local";

async function main() {
  mkdirSync(SHOT, { recursive: true });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
  // Owner me restorant + menu, dhe super admin.
  const owner = await prisma.user.create({ data: { email: `owner${SUF}`, role: "RESTAURANT_OWNER", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) }, select: { id: true } });
  const { restaurantId } = await prisma.$transaction((tx) => createRestaurantForOwner(tx, owner.id, "Resto Vizuale"));
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { isPublished: true } });
  const cat = await prisma.category.create({ data: { restaurantId, nameAl: "Pjata kryesore", nameEn: "Mains" } });
  await prisma.menuItem.create({ data: { categoryId: cat.id, nameAl: "Tavë kosi", nameEn: "Tave kosi", price: 700, isVisible: true } });
  await prisma.user.create({ data: { email: `admin${SUF}`, role: "SUPER_ADMIN", emailVerified: true, passwordHash: await bcrypt.hash(PW, 10) } });

  const browser = await launchBrowser();
  const widths = [{ w: 390, h: 844, tag: "390" }, { w: 1440, h: 900, tag: "1440" }];
  const problems: string[] = [];

  async function shoot(ctx: any, email: string | null, path: string, name: string) {
    for (const vp of widths) {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      if (email) {
        await page.goto(`${BASE}/login`);
        await page.fill("input[type=email]", email);
        await page.fill("input[type=password]", PW);
        await page.click("button[type=submit]");
        for (let i = 0; i < 40; i++) { if (new URL(page.url()).pathname.startsWith("/")) { if (!new URL(page.url()).pathname.startsWith("/login")) break; } await page.waitForTimeout(200); }
      }
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      const overflow = m.sw > m.cw + 1;
      if (overflow) problems.push(`${name}@${vp.tag}: scrollW=${m.sw} > ${m.cw}`);
      await page.screenshot({ path: `${SHOT}/${name}-${vp.tag}.png`, fullPage: true });
      console.log(`  ${overflow ? "⚠️" : "✅"} ${name}@${vp.tag} (sw=${m.sw} cw=${m.cw})`);
      await context.close();
    }
  }

  console.log("Public:");
  await shoot(null, null, "/", "landing");
  await shoot(null, null, "/login", "login");
  console.log("Panel (owner):");
  await shoot(null, `owner${SUF}`, "/dashboard", "dashboard");
  await shoot(null, `owner${SUF}`, "/dashboard/menu", "menu");
  await shoot(null, `owner${SUF}`, "/dashboard/settings", "settings");
  await shoot(null, `owner${SUF}`, "/dashboard/billing", "billing");
  console.log("Admin:");
  await shoot(null, `admin${SUF}`, "/admin/restaurants", "admin-restaurants");

  await browser.close();
  await prisma.user.deleteMany({ where: { email: { endsWith: SUF } } });
  console.log(`\n=== Overflow: ${problems.length} ===`);
  problems.forEach((p) => console.log("  " + p));
  await prisma.$disconnect();
  process.exit(0);
}
main().catch(async (e) => { console.error("FATAL", e); await prisma.$disconnect(); process.exit(1); });
