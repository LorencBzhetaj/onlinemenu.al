"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const ERRORS: Record<string, string> = {
  expired: "Ftesa ka skaduar.",
  used: "Ftesa është përdorur tashmë.",
  revoked: "Ftesa u anulua.",
  email_mismatch: "Email-i nuk përputhet me ftesën.",
  not_found: "Ftesa nuk u gjet.",
};

export function AcceptInvite({ token, restaurantName }: { token: string; restaurantName: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setError(ERRORS[d.error] ?? "Pranimi dështoi."); return; }
      // Rifresko JWT-në (re-run i jwt callback-ut) që middleware të njohë membership-in e ri,
      // përndryshe përdoruesi (pa restorant në token) ridrejtohet te /onboarding.
      try { await update(); } catch {}
      router.push(`/dashboard?r=${encodeURIComponent(d.restaurantId)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <button onClick={accept} disabled={busy} className="inline-flex min-h-11 items-center rounded-full bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
        {busy ? "Duke pranuar…" : `Bashkohu me ${restaurantName}`}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
