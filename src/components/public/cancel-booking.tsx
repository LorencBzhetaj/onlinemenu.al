"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelBooking({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!confirm("Je i sigurt që dëshiron ta anulosh rezervimin?")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/public/bookings/${token}/cancel`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setError(d.error ?? "Anulimi dështoi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Diçka shkoi keq. Provoni përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="rsv-btn"
        style={{ background: "transparent", color: "#b4461f", borderColor: "rgba(180,70,31,0.4)" }}
      >
        {busy ? "Duke anuluar…" : "Anulo rezervimin"}
      </button>
      {error && <p style={{ color: "#b4461f", fontSize: "0.82rem", textAlign: "center" }}>{error}</p>}
    </>
  );
}
