"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/google-button";

export default function RegisterPage() {
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

    // Hyr automatikisht pas regjistrimit.
    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-midnight text-alpine-cream px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl text-center mb-2">Fillo provën falas</h1>
        <p className="text-center text-sm text-alpine-cream/60 mb-8">
          30 ditë, pa kartë krediti.
        </p>

        <GoogleButton label="Regjistrohu me Google" />
        <OrDivider />

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Emri i restorantit"
            required
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            className="w-full rounded-lg bg-midnight-soft border border-alpine-cream/20 px-4 py-3 outline-none focus:border-alpine-gold"
          />
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
            placeholder="Fjalëkalimi (min. 8 karaktere)"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-midnight-soft border border-alpine-cream/20 px-4 py-3 outline-none focus:border-alpine-gold"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-alpine-gold py-3 text-midnight font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Duke krijuar..." : "Krijo llogari"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-alpine-cream/70">
          Ke llogari?{" "}
          <Link href="/login" className="text-alpine-gold hover:underline">
            Hyr
          </Link>
        </p>
      </div>
    </main>
  );
}
