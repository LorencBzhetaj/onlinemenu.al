"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthBrand } from "@/components/auth-brand";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setMessage(data.message ?? "Nëse ky email ekziston, do të merrni një link.");
    setDone(true);
  }

  return (
    <main className="min-h-screen grid place-items-center bg-canvas text-ink px-6">
      <div className="w-full max-w-sm">
        <AuthBrand />
        <h1 className="font-heading text-3xl text-center mb-2">Kam harruar password-in</h1>
        <p className="text-center text-sm text-muted mb-8">
          Shkruaj email-in tënd dhe do të të dërgojmë një link për të rivendosur password-in.
        </p>

        {done ? (
          <div className="rounded-lg border border-primary/40 bg-surface p-5 text-center">
            <p className="text-muted text-sm">{message}</p>
            <Link href="/login" className="inline-block mt-4 text-primary hover:underline text-sm">
              ← Kthehu te kyçja
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface border border-line px-4 py-3 outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-11 rounded-lg bg-primary py-3 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Duke dërguar…" : "Dërgo linkun"}
            </button>
            <p className="text-center text-sm text-muted">
              <Link href="/login" className="text-primary hover:underline">
                ← Kthehu te kyçja
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
