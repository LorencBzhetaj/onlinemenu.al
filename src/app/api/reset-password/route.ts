import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");

  if (!token) {
    return NextResponse.json({ error: "Token mungon." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password-i duhet të ketë të paktën 8 karaktere." },
      { status: 400 }
    );
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  // Verifikim: ekziston, s'është përdorur, s'ka skaduar.
  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Linku ka skaduar ose është përdorur. Kërkoni një të ri." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Atomik: ndrysho password-in DHE shëno token-in si të përdorur (parandalon ripërdorim).
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
