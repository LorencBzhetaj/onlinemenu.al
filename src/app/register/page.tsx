"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OrDivider } from "@/components/google-button";
import { OAuthButtons, useHasOAuth } from "@/components/oauth-buttons";
import { AuthBrand } from "@/components/auth-brand";

export default function RegisterPage() {
  const hasOAuth = useHasOAuth();
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantName, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ndodhi një gabim gjatë regjistrimit.");
      setLoading(false);
      return;
    }

    // PA auto-login: dërgo te faqja që kërkon verifikimin e email-it.
    router.push(`/register/check-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <main className="min-h-screen grid place-items-center bg-canvas text-ink px-6">
      <div className="w-full max-w-sm">
        <AuthBrand />
        <h1 className="font-heading text-3xl text-center mb-2">Fillo provën falas</h1>
        <p className="text-center text-sm text-muted mb-8">
          30 ditë, pa kartë krediti.
        </p>

        {/* Me Google/Apple: llogaria krijohet, pastaj vazhdon te "Regjistro biznesin" (/onboarding). */}
        <OAuthButtons callbackUrl="/onboarding" verb="Regjistrohu" />
        {hasOAuth && <OrDivider />}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Emri i restorantit"
            required
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            className="w-full rounded-lg bg-surface border border-line px-4 py-3 outline-none focus:border-primary"
          />
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
            placeholder="Fjalëkalimi (min. 8 karaktere)"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-surface border border-line px-4 py-3 outline-none focus:border-primary"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Duke krijuar..." : "Krijo llogari"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted leading-relaxed">
          Duke krijuar llogari, konfirmoni që keni lexuar{" "}
          <Link href="/kushtet" className="text-primary underline">
            Kushtet e përdorimit
          </Link>{" "}
          dhe{" "}
          <Link href="/privatesia" className="text-primary underline">
            Politikën e privatësisë
          </Link>
          .
        </p>
        <p className="mt-6 text-center text-sm text-muted">
          Ke llogari?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Hyr
          </Link>
        </p>
      </div>
    </main>
  );
}
