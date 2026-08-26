import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  const record = token
    ? await prisma.passwordResetToken.findUnique({ where: { token } })
    : null;

  const valid = !!record && !record.used && record.expiresAt >= new Date();

  return (
    <main className="min-h-screen grid place-items-center bg-midnight text-alpine-cream px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl text-center mb-8">Vendos një password të ri</h1>

        {valid ? (
          <ResetForm token={token} />
        ) : (
          <div className="rounded-lg border border-red-400/30 bg-midnight-soft p-5 text-center">
            <p className="text-alpine-cream/80 text-sm">
              Linku ka skaduar ose është përdorur.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block mt-4 text-alpine-gold hover:underline text-sm"
            >
              Kërko një link të ri
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
