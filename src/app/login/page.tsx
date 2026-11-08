"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OrDivider } from "@/components/google-button";
import { OAuthButtons, useHasOAuth } from "@/components/oauth-buttons";

export default function LoginPage() {
  const router = useRouter();
  const hasOAuth = useHasOAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetOk, setResetOk] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);

  // Mesazh suksesi pas rivendosjes së password-it (/login?reset=1) dhe arsyet e refuzimit OAuth.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("reset") === "1") setResetOk(true);
    const providerName = sp.get("provider") === "apple" ? "Apple" : "Google";
    const reason = sp.get("error");
    if (reason === "account_exists") {
      setError(
        `Ky email ka tashmë një llogari në OnlineMenu.al. Hyni me metodën që keni përdorur më parë (email dhe fjalëkalim ose ofruesin tjetër), pastaj lidheni ${providerName} nga “Llogaria ime”.`
      );
    } else if (reason === "email_unverified") {
      setError(`${providerName} nuk e konfirmoi email-in tuaj. Provoni një mënyrë tjetër hyrjeje.`);
    } else if (reason === "missing_email") {
      setError(`${providerName} nuk na dha një email. Hyni me një mënyrë tjetër ose lejoni ndarjen e email-it.`);
    } else if (reason) {
      setError("Hyrja nuk u përfundua. Provoni përsëri.");
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
      if (res.error === "EMAIL_NOT_VERIFIED") {
        setError("Email-i s'është verifikuar ende. Kontrollo kutinë ose ridërgo verifikimin.");
        setNeedsVerify(true);
      } else {
        setError("Email ose fjalëkalim i pasaktë.");
      }
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-canvas text-ink px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl text-center mb-8">Hyr në llogari</h1>

        {resetOk && (
          <div className="mb-5 rounded-lg border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-700 text-center">
            Password-i u ndryshua me sukses. Tani mund të kyçesh.
          </div>
        )}

        <OAuthButtons callbackUrl="/dashboard" />
        {hasOAuth && <OrDivider />}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-surface border border-line px-4 py-3 outline-none focus:border-primary"
          />
          <input
            type="password"
            placeholder="Fjalëkalimi"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-surface border border-line px-4 py-3 outline-none focus:border-primary"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {needsVerify && (
            <Link
              href={`/register/check-email?email=${encodeURIComponent(email)}`}
              className="block text-sm text-primary hover:underline"
            >
              Verifiko email-in →
            </Link>
          )}
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-muted hover:text-primary">
              Kam harruar password-in?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 rounded-lg bg-primary py-3 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Duke hyrë..." : "Hyr"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          S&apos;ke llogari?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Regjistrohu
          </Link>
        </p>
      </div>
    </main>
  );
}
