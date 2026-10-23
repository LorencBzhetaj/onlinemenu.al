"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// Përkthen arsyen e dështimit (nga authorize) në mesazh për përdoruesin.
function messageFor(error: string | undefined): string {
  switch (error) {
    case "expired":
      return "Linku ose kodi ka skaduar / është përdorur. Ridërgo një të ri.";
    case "wrong_code":
      return "Kod i gabuar. Kontrollo dhe provo sërish.";
    case "locked":
      return "Shumë tentativa të gabuara. Ridërgo një kod të ri.";
    case "invalid":
      return "Kredencial i pavlefshëm. Ridërgo verifikimin.";
    default:
      return "Verifikimi dështoi. Provo sërish ose ridërgo kodin.";
  }
}

export default function VerifyEmailClient() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const emailParam = params.get("email") ?? "";

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(credentials: Record<string, string>) {
    setLoading(true);
    setError(null);
    const res = await signIn("verify-login", { ...credentials, redirect: false });
    setLoading(false);
    if (res?.ok && !res.error) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setError(messageFor(res?.error ?? undefined));
  }

  // Rruga A — linku: hapja GET nuk konsumon; konsumimi bëhet VETËM me këtë klik (POST).
  if (token) {
    return (
      <Shell>
        <h1 className="font-heading text-2xl sm:text-3xl mb-3">Konfirmo verifikimin</h1>
        <p className="text-sm leading-relaxed text-alpine-cream/70 mb-6">
          Kliko më poshtë për të verifikuar email-in dhe aktivizuar llogarinë.
        </p>
        <button
          onClick={() => verify({ token })}
          disabled={loading}
          className="w-full min-h-11 rounded-lg bg-alpine-gold py-3 text-midnight font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Duke verifikuar..." : "Verifiko email-in"}
        </button>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <BackLinks />
      </Shell>
    );
  }

  // Rruga B — kodi: formular email + kod 6-shifror.
  return (
    <Shell>
      <h1 className="font-heading text-2xl sm:text-3xl mb-3">Vendos kodin</h1>
      <p className="text-sm leading-relaxed text-alpine-cream/70 mb-6">
        Fut email-in dhe kodin 6-shifror që të dërguam.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify({ email: email.trim().toLowerCase(), code: code.trim() });
        }}
        className="space-y-4"
      >
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-midnight-soft border border-alpine-cream/20 px-4 py-3 outline-none focus:border-alpine-gold"
        />
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="Kodi 6-shifror"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg bg-midnight-soft border border-alpine-cream/20 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-alpine-gold"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full min-h-11 rounded-lg bg-alpine-gold py-3 text-midnight font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Duke verifikuar..." : "Verifiko"}
        </button>
      </form>
      <BackLinks email={email} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center bg-midnight text-alpine-cream px-6">
      <div className="w-full max-w-sm text-center">{children}</div>
    </main>
  );
}

function BackLinks({ email }: { email?: string }) {
  const href = email ? `/register/check-email?email=${encodeURIComponent(email)}` : "/register/check-email";
  return (
    <p className="mt-8 text-sm text-alpine-cream/60">
      S&apos;mori email-in?{" "}
      <Link href={href} className="text-alpine-gold hover:underline">
        Ridërgo
      </Link>
    </p>
  );
}
