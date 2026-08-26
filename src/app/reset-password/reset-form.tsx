"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg bg-midnight-soft border border-alpine-cream/20 px-4 py-3 outline-none focus:border-alpine-gold";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password-i duhet të ketë të paktën 8 karaktere.");
      return;
    }
    if (password !== confirm) {
      setError("Password-et nuk përputhen.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Ndodhi një gabim.");
      return;
    }

    router.push("/login?reset=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="password"
        placeholder="Password i ri (min. 8 karaktere)"
        required
        minLength={8}
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
      />
      <input
        type="password"
        placeholder="Konfirmo password-in"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={inputClass}
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-11 rounded-lg bg-alpine-gold py-3 text-midnight font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? "Duke ruajtur…" : "Ruaj password-in e ri"}
      </button>
    </form>
  );
}
