import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createPendingRegistration } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    // Rate limit i qëndrueshëm (PostgreSQL): max 5 regjistrime për IP në orë.
    if (!(await rateLimit(`register:ip:${clientIp(req)}`, 5, 60 * 60 * 1000))) {
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

    // Krijim/rifreskim ATOMIK i regjistrimit të papërfunduar (password + kredencial në një tx).
    // Restaurant+trial krijohen VETËM pas verifikimit të email-it (shih consumeVerification).
    const reg = await createPendingRegistration(email, password, restaurantName);
    if (reg.status === "already_verified") {
      return NextResponse.json(
        { error: "Ky email është i regjistruar tashmë." },
        { status: 409 }
      );
    }

    // Dërgo email-in me kredencialin e sapolëshuar (link + kod).
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    const verifyLink = `${base}/verify-email?token=${reg.token}`;
    const result = await sendVerificationEmail(email, verifyLink, reg.code);
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
