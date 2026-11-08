"use client";

// Lidhja e qëllimshme e Google/Apple: rikonfirmim (fjalëkalim, ose hyrje e freskët) → link intent → OAuth.
import { useState } from "react";
import { signIn, signOut } from "next-auth/react";

type P = "google" | "apple";
const NAME: Record<P, string> = { google: "Google", apple: "Apple" };

export function AccountLinking({ hasPassword, verified, available }: { hasPassword: boolean; verified: boolean; available: P[] }) {
  const [provider, setProvider] = useState<P | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needReauth, setNeedReauth] = useState(false);

  if (!verified || available.length === 0) return null;

  async function start(p: P) {
    setError(null);
    setNeedReauth(false);
    setBusy(true);
    const r = await fetch("/api/account/link-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p, password: hasPassword ? password : undefined }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      if (d.error === "reauth_required") setNeedReauth(true);
      else setError(d.error ?? "Lidhja nuk nisi.");
      return;
    }
    await signIn(p, { callbackUrl: "/account?linked=1" });
  }

  return (
    <div className="mt-4 border-t border-om-line pt-4">
      <p className="text-sm text-om-ink-soft">Lidh një mënyrë tjetër hyrjeje. Për siguri, konfirmoni sërish identitetin.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {available.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setProvider(p);
              setError(null);
              if (!hasPassword) void start(p);
            }}
            className="inline-flex min-h-11 items-center rounded-xl border-2 border-om-aubergine px-4 text-sm font-extrabold"
          >
            Lidh {NAME[p]}
          </button>
        ))}
      </div>
      {provider && hasPassword && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void start(provider);
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col text-sm font-bold">
            Fjalëkalimi aktual
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11 rounded-xl border-2 border-om-line bg-om-white px-3 font-normal outline-none focus:border-om-aubergine"
            />
          </label>
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-xl bg-om-aubergine px-4 text-sm font-extrabold text-white disabled:opacity-60">
            Konfirmo dhe lidh {NAME[provider]}
          </button>
        </form>
      )}
      {needReauth && (
        <p className="mt-3 text-sm font-bold" role="alert">
          Për siguri, hyni sërish dhe provoni brenda 10 minutave.{" "}
          <button type="button" className="underline" onClick={() => signOut({ callbackUrl: "/login" })}>
            Hyni sërish
          </button>
        </p>
      )}
      {error && <p className="mt-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
    </div>
  );
}

/** Dalja nga llogaria (kjo faqe s'ka panelin me "Dil"). */
export function AccountSignOut() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-flex min-h-11 items-center rounded-2xl border-2 border-om-aubergine px-5 font-extrabold text-om-aubergine"
    >
      Dil nga llogaria
    </button>
  );
}
