import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── GUARD SIGURIE ──────────────────────────────────────────────
  // Ky script FSHIN e rikrijon të dhënat e Gjeçaj (përfshirë fotot e ngarkuara).
  // Bllokohet në prodhim dhe kërkon konfirmim eksplicit kudo tjetër.
  if (process.env.NODE_ENV === "production") {
    console.error("❌ REFUZUAR: test-data NUK ekzekutohet kurrë në prodhim.");
    process.exit(1);
  }
  if (process.env.ALLOW_SEED !== "true") {
    console.error(
      "❌ REFUZUAR: ky është seed testi që fshin të dhëna.\n" +
        "   Për ta ekzekutuar me qëllim: ALLOW_SEED=true node --env-file=.env --import tsx prisma/test-data.ts\n" +
        "   (sigurohu që DATABASE_URL NUK tregon te databaza e prodhimit)"
    );
    process.exit(1);
  }

  const userCount = await prisma.user.count();
  console.log(`(probe) përdorues në DB: ${userCount}`);

  const passwordHash = await bcrypt.hash("gjecaj1234", 10);
  const owner = await prisma.user.upsert({
    where: { email: "gjecaj@test.al" },
    update: {},
    create: { email: "gjecaj@test.al", passwordHash, role: "RESTAURANT_OWNER" },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "gjecaj-restaurant" },
    update: {
      name: "Gjeçaj Restaurant",
      isPublished: true,
      menuPhotoStyle: "large",
      primaryColor: "#14202b",
      accentColor: "#b9a365",
      fontHeading: "Playfair Display",
      fontBody: "Cormorant Garamond",
      phone: "+355 67 204 6333",
      whatsapp: "355672046333",
      address: "Theth, Shkodër · Alpet Shqiptare",
      estYear: 1922,
      taglineAl: "Shije të Alpeve",
      taglineEn: "Flavours of the Alps",
      subtitleAl: "Kuzhinë Tradicionale · Theth, Alpet Shqiptare",
      subtitleEn: "Traditional Cuisine · Theth, Albanian Alps",
    },
    create: {
      slug: "gjecaj-restaurant",
      name: "Gjeçaj Restaurant",
      isPublished: true,
      ownerId: owner.id,
      primaryColor: "#14202b",
      accentColor: "#b9a365",
      phone: "+355 67 204 6333",
      whatsapp: "355672046333",
      address: "Theth, Shkodër · Alpet Shqiptare",
      estYear: 1922,
      taglineAl: "Shije të Alpeve",
      taglineEn: "Flavours of the Alps",
      subtitleAl: "Kuzhinë Tradicionale · Theth, Alpet Shqiptare",
      subtitleEn: "Traditional Cuisine · Theth, Albanian Alps",
    },
  });

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  await prisma.subscription.upsert({
    where: { restaurantId: restaurant.id },
    update: { status: "active", expiresAt },
    create: { restaurantId: restaurant.id, plan: "yearly", status: "active", expiresAt },
  });

  // Idempotencë
  await prisma.category.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.tastingMenu.deleteMany({ where: { restaurantId: restaurant.id } });

  const it = (nameAl: string, nameEn: string, price: number, descAl = "", descEn = "", sortOrder = 0, isVisible = true) => ({
    nameAl, nameEn, price, descAl: descAl || null, descEn: descEn || null, sortOrder, isVisible,
  });

  // ── Antipasta (karta) + 1 artikull i fshehur ──
  await prisma.category.create({
    data: {
      restaurantId: restaurant.id, nameAl: "Antipasta", nameEn: "Starters", icon: "antipasta", sortOrder: 0,
      items: { create: [
        it("Proshutë & Mix Djathrash", "Cured Meat & Cheese Plate", 1100, "Proshutë e kuruar në shtëpi, djathëra me erëza të Vëlecikut, ullinj.", "House-cured prosciutto, assorted cheeses from Vëlecik, olives.", 0),
        it("Meze Tradicionale", "Traditional Meze", 650, "Djathë i bardhë, turshi, ullinj, salcë kosi, piper i mbushur me djathë krem.", "White cheese, pickles, olives, yoghurt sauce, pepper filled with cream cheese.", 1),
        it("Fli", "Fli", 590, "Shtresa tradicionale të holla, pjekur mbi zjarr.", "Traditional thin layers baked over open fire.", 2),
        it("Artikull i Fshehur", "Hidden Item", 999, "", "", 3, false),
      ] },
    },
  });

  // ── Supa ──
  await prisma.category.create({
    data: {
      restaurantId: restaurant.id, nameAl: "Supa", nameEn: "Soups", icon: "supa", sortOrder: 1,
      items: { create: [
        it("Supë Kremoze Perimesh", "Cream of Vegetable Soup", 300, "Me perime të freskëta sezonale.", "With fresh seasonal vegetables.", 0),
        it("Supë Pule Kremoze", "Creamy Chicken Soup", 300, "Gjalpë, miell, vezë, lëng limoni, lëng pule.", "Butter, flour, eggs, lemon juice, chicken broth.", 1),
        it("Groshë", "Bean Stew", 300, "Fasule nga rajoni i Shalës, gatuar me hudhër shtëpie.", "Beans from the Shala region, cooked with homemade garlic.", 2),
      ] },
    },
  });

  // ── Sallata ──
  await prisma.category.create({
    data: {
      restaurantId: restaurant.id, nameAl: "Sallata", nameEn: "Salads", icon: "sallata", sortOrder: 2,
      items: { create: [
        it("Sallatë Fshati", "Village Salad", 500, "Domate të freskëta, kastravec, speca, qepë, djathë.", "Fresh tomatoes, cucumber, peppers, onion, cheese.", 0),
        it("Sallatë Mikse", "Mixed Salad", 550, "Marulë, domate, kastravec, speca, qepë, djathë vendas, ullinj.", "Lettuce, tomato, cucumber, peppers, onion, local cheese, olives.", 1),
        it("Sallatë e Shefit", "Chef's Salad", 590, "Perime sezonale dhe copa pule.", "Seasonal vegetables and chicken pieces.", 2),
      ] },
    },
  });

  // ── Pjata Kryesore (karta) ──
  await prisma.category.create({
    data: {
      restaurantId: restaurant.id, nameAl: "Pjata Kryesore", nameEn: "Main Course", icon: "kryesore", sortOrder: 3,
      items: { create: [
        it("Byrek", "Byrek", 450, "Me spinaq, djathë ose qepë.", "With spinach, cheese, or onion.", 0),
        it("Fërgese", "Fërgese", 800, "Me gjizë dhe speca.", "With ricotta and peppers.", 1),
        it("Gjysmë Pulë e Pjekur në Furrë", "Half Roasted Chicken", 1700, "Shërbehet me oriz (pilaf shqiptar).", "Served with rice (Albanian pilaf).", 2),
        it("Qengj ose Keç i Pjekur në Furrë", "Oven-Roasted Lamb or Baby Goat", 2250, "Shërbehet me patate furre (500 gr).", "Served with roasted potatoes (500g).", 3),
      ] },
    },
  });

  // ── Pije (nën-kategori -> layout 2-kolonësh, pa përshkrime) ──
  await prisma.category.create({
    data: {
      restaurantId: restaurant.id, nameAl: "Pije", nameEn: "Drinks", icon: "pije", sortOrder: 4,
      subcategories: { create: [
        { nameAl: "Pije të Nxehta", nameEn: "Hot Drinks", sortOrder: 0, items: { create: [
          it("Kafe Ekspres", "Espresso", 100, "", "", 0),
          it("Çaj Mali", "Mountain Tea", 100, "", "", 1),
        ] } },
        { nameAl: "Pije të Ftohta", nameEn: "Cold Drinks", sortOrder: 1, items: { create: [
          it("Birra Elbar", "Elbar Beer", 300, "", "", 0),
          it("Raki Rrushi", "Grape Raki", 100, "", "", 1),
          it("Ujë Mineral", "Mineral Water", 80, "", "", 2),
        ] } },
      ] },
    },
  });

  // ── Fruta & Ëmbëlsira ──
  await prisma.category.create({
    data: {
      restaurantId: restaurant.id, nameAl: "Fruta & Ëmbëlsira", nameEn: "Fruits & Desserts", icon: "embelsira", sortOrder: 5,
      items: { create: [
        it("Revani", "Traditional Revani", 250, "Ëmbëlsirë tradicionale, porcion.", "Traditional dessert cake, single portion.", 0),
        it("Miks Frutash Sezonale", "Mixed Seasonal Fruits", 250, "Frutat e sezonit, porcion.", "Seasonal fruit, single portion.", 1),
      ] },
    },
  });

  // ── Menu Degustuese ──
  await prisma.tastingMenu.create({
    data: {
      restaurantId: restaurant.id, name: "Aromat e Alpeve", price: 4000, guestCount: 2,
      courses: [
        { titleAl: "Mesoret", titleEn: "Starter", descAl: "Djathë i bardhë gjizë, turshi shtëpie, salcë kosi, byrek, bukë misri, fërgese, pllaqi.", descEn: "White cottage cheese, homemade pickles, yoghurt sauce, byrek, corn bread, fërgese, pllaqi." },
        { titleAl: "Kryesoret", titleEn: "Main", descAl: "Djathë në furrë, qervish me arra, gjysmë pulë me oriz.", descEn: "Cheese in the oven, qervish with walnuts, half chicken with rice." },
        { titleAl: "Ëmbëlsirë", titleEn: "Dessert", descAl: "Revani — ëmbëlsirë tradicionale me reçel shtëpie.", descEn: "Traditional Revani, garnished with homemade jam." },
      ],
    },
  });
  await prisma.tastingMenu.create({
    data: {
      restaurantId: restaurant.id, name: "Sofra e Malësorit", price: 5000, guestCount: 2,
      courses: [
        { titleAl: "Mesoret", titleEn: "Starter", descAl: "Djathë i bardhë gjizë, turshi shtëpie, salcë kosi, byrek/fli, bukë misri, fërgese, pllaqi.", descEn: "White cottage cheese, homemade pickles, yoghurt sauce, byrek/fli, corn bread, fërgese, pllaqi." },
        { titleAl: "Kryesoret", titleEn: "Main", descAl: "Maze e zjarrtë, speca/patëllxhan të mbushur, mish qingji me patate furre (500gr).", descEn: "Maze cooked over fire, stuffed peppers/eggplant, oven-roasted lamb with potatoes (500g)." },
        { titleAl: "Ëmbëlsirë", titleEn: "Dessert", descAl: "Sultjash — ëmbëlsirë tradicionale me oriz dhe qumësht.", descEn: "Sultjash, traditional dessert with rice and milk." },
      ],
    },
  });

  console.log(`✔ Test data i plotë për "${restaurant.name}" → /m/${restaurant.slug}`);
  console.log(`  6 kategori (Pije me 2 nën-kategori), 2 menu degustuese, 1 artikull i fshehur.`);
  console.log(`  Login pronari: gjecaj@test.al / gjecaj1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
