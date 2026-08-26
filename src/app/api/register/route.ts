import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const TRIAL_DAYS = 30;

export async function POST(req: Request) {
  try {
    // Rate limit bazë: max 5 regjistrime për IP në orë (best-effort).
    if (!rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Shumë përpjekje. Provoni sërish më vonë." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const email = String(body.email ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");
    const restaurantName = String(body.restaurantName ?? "").trim();

    if (!email || !password || !restaurantName) {
      return NextResponse.json(
        { error: "Email, fjalëkalimi dhe emri i restorantit janë të detyrueshëm." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Fjalëkalimi duhet të ketë të paktën 8 karaktere." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ky email është i regjistruar tashmë." },
        { status: 409 }
      );
    }

    // Gjenero një slug unik nga emri i restorantit.
    const base = slugify(restaurantName) || "restoranti";
    let slug = base;
    let n = 1;
    while (await prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "RESTAURANT_OWNER",
        restaurants: {
          create: {
            name: restaurantName,
            slug,
            subscription: {
              create: {
                plan: "monthly",
                status: "trial",
                expiresAt,
              },
            },
          },
        },
      },
      include: { restaurants: true },
    });

    return NextResponse.json(
      { ok: true, slug: user.restaurants[0]?.slug },
      { status: 201 }
    );
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json(
      { error: "Ndodhi një gabim gjatë regjistrimit." },
      { status: 500 }
    );
  }
}
