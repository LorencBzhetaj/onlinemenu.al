"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/google-button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetOk, setResetOk] = useState(false);

  // Mesazh suksesi pas rivendosjes së password-it (/login?reset=1).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      setResetOk(true);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Email ose fjalëkalim i pasaktë.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-midnight text-alpine-cream px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl text-center mb-8">Hyr në llogari</h1>

        {resetOk && (
          <div className="mb-5 rounded-lg border border-green-400/30 bg-green-400/10 px-4 py-3 text-sm text-green-300 text-center">
            Password-i u ndryshua me sukses. Tani mund të kyçesh.
          </div>
        )}

        <GoogleButton label="Vazhdo me Google" />
        <OrDivider />

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-midnight-soft border border-alpine-cream/20 px-4 py-3 outline-none focus:border-alpine-gold"
          />
          <input
            type="password"
            placeholder="Fjalëkalimi"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-midnight-soft border border-alpine-cream/20 px-4 py-3 outline-none focus:border-alpine-gold"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-alpine-cream/60 hover:text-alpine-gold">
              Kam harruar password-in?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 rounded-lg bg-alpine-gold py-3 text-midnight font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Duke hyrë..." : "Hyr"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-alpine-cream/70">
          S&apos;ke llogari?{" "}
          <Link href="/register" className="text-alpine-gold hover:underline">
            Regjistrohu
          </Link>
        </p>
      </div>
    </main>
  );
}
