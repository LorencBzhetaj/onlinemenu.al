"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantName }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Ndodhi një gabim.");
      setLoading(false);
      return;
    }

    // Restoranti u krijua — shko te dashboard-i (refresh që token të marrë restaurantId).
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-midnight text-alpine-cream px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl text-center mb-2">Një hap i fundit</h1>
        <p className="text-center text-sm text-alpine-cream/60 mb-8">
          Si quhet restoranti juaj? Do të krijojmë menunë tuaj me një provë falas 30-ditore.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Emri i restorantit"
            required
            autoFocus
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            className="w-full rounded-lg bg-midnight-soft border border-alpine-cream/20 px-4 py-3 outline-none focus:border-alpine-gold"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 rounded-lg bg-alpine-gold py-3 text-midnight font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Duke krijuar…" : "Vazhdo"}
          </button>
        </form>
      </div>
    </main>
  );
}
