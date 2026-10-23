import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { issueVerification } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";

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

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });
    // Email i regjistruar DHE i verifikuar → marrë vërtet.
    if (existing?.emailVerified) {
      return NextResponse.json(
        { error: "Ky email është i regjistruar tashmë." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Krijo (ose rifresko një regjistrim të papërfunduar) User-in — PA Restaurant.
    // Restaurant+trial krijohen VETËM pas verifikimit të email-it (shih consumeVerification).
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, pendingRestaurantName: restaurantName },
          select: { id: true },
        })
      : await prisma.user.create({
          data: {
            email,
            passwordHash,
            role: "RESTAURANT_OWNER",
            emailVerified: false,
            pendingRestaurantName: restaurantName,
          },
          select: { id: true },
        });

    // Gjenero kredencialin e verifikimit (link + kod) dhe dërgo email-in.
    const { token, code } = await issueVerification(user.id);
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    const verifyLink = `${base}/verify-email?token=${token}`;

    const result = await sendVerificationEmail(email, verifyLink, code);
    if (!result.ok) {
      // Logo për debug — por mos e blloko regjistrimin (përdoruesi mund të ridërgojë).
      console.error("Verification email error:", result.error);
    }

    // PA auto-login: përdoruesi duhet të verifikojë i pari.
    return NextResponse.json({ ok: true, email }, { status: 201 });
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json(
      { error: "Ndodhi një gabim gjatë regjistrimit." },
      { status: 500 }
    );
  }
}
