import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 orë

// I njëjti mesazh gjithmonë — parandalon "user enumeration".
const GENERIC = {
  ok: true,
  message: "Nëse ky email ekziston, do të merrni një link për rivendosje.",
};

export async function POST(req: Request) {
  // Rate limit: max 3 kërkesa/orë/IP (parandalon spam email-esh).
  if (!rateLimit(`forgot:${clientIp(req)}`, 3, TOKEN_TTL_MS)) {
    return NextResponse.json(
      { error: "Shumë kërkesa. Provoni sërish më vonë." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Email-i është i detyrueshëm." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Vetëm nëse email-i ekziston: krijo token + dërgo email. Përndryshe s'bëjmë asgjë,
  // por kthejmë TË NJËJTIN mesazh (mos zbulo që s'ekziston).
  if (user) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    const resetLink = `${base}/reset-password?token=${token}`;

    const result = await sendPasswordResetEmail(email, resetLink);
    if (!result.ok) {
      // Logo për debug, por MOS ia zbulo përdoruesit (mbaj mesazhin gjenerik).
      console.error("Resend error:", result.error);
    } else {
      console.log("Reset email sent, Resend id:", result.id);
    }
  }

  return NextResponse.json(GENERIC);
}
