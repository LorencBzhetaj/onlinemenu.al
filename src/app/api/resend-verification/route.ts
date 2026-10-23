import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { issueVerification } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";

const HOUR_MS = 60 * 60 * 1000;

// Mesazh i njëjtë gjithmonë — mos zbulo nëse email-i ekziston / është verifikuar.
const GENERIC = {
  ok: true,
  message: "Nëse ky email pret verifikim, të dërguam një link dhe kod të ri.",
};

export async function POST(req: Request) {
  const ip = clientIp(req);
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Email-i është i detyrueshëm." }, { status: 400 });
  }

  // Rate limit i dyfishtë: 3/orë për IP DHE 3/orë për email (parandalon spam ridërgimi).
  if (!rateLimit(`resend:ip:${ip}`, 3, HOUR_MS) || !rateLimit(`resend:email:${email}`, 3, HOUR_MS)) {
    return NextResponse.json(
      { error: "Shumë kërkesa ridërgimi. Provoni sërish pas pak." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  // Vetëm nëse ekziston DHE është i paverifikuar: ri-krijo kredencialin (invalidon të vjetrin).
  if (user && !user.emailVerified) {
    const { token, code } = await issueVerification(user.id);
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    const verifyLink = `${base}/verify-email?token=${token}`;
    const result = await sendVerificationEmail(email, verifyLink, code);
    if (!result.ok) console.error("Resend verification email error:", result.error);
  }

  return NextResponse.json(GENERIC);
}
