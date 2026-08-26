"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_OPTIONS, STATUS_OPTIONS, PLAN_DAYS } from "@/lib/subscription";

const inputClass =
  "w-full rounded-lg bg-midnight border border-alpine-cream/20 px-3 py-2 text-alpine-cream outline-none focus:border-alpine-gold";

export function SubscriptionForm({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: { status: string; plan: string; lastPaymentNote: string | null };
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status);
  const [plan, setPlan] = useState(initial.plan);
  const [note, setNote] = useState(initial.lastPaymentNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/admin/restaurants/${restaurantId}/subscription`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, plan, lastPaymentNote: note }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Ruajtja dështoi.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm text-alpine-cream/70 mb-1">Statusi</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm text-alpine-cream/70 mb-1">Plani</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>
            {PLAN_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {status === "active" && (
        <p className="text-xs text-alpine-gold/80">
          Skadimi do të llogaritet automatikisht: <b>+{PLAN_DAYS[plan]} ditë nga sot</b>.
        </p>
      )}
      {status === "trial" && (
        <p className="text-xs text-alpine-gold/80">Skadimi do të vendoset +30 ditë nga sot.</p>
      )}
      {(status === "expired" || status === "cancelled") && (
        <p className="text-xs text-alpine-cream/40">
          Skadimi ekzistues ruhet; menuja publike shfaqet menjëherë si jo-aktive.
        </p>
      )}

      <label className="block">
        <span className="block text-sm text-alpine-cream/70 mb-1">
          Shënim Pagese <span className="text-alpine-cream/30">(vetëm i brendshëm)</span>
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="p.sh. Paguar 50€ via WhatsApp, 10 Shtator 2026"
          className={inputClass}
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="min-h-11 rounded-lg bg-alpine-gold px-5 py-2 text-midnight font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Duke ruajtur…" : "Ruaj Ndryshimet e Abonimit"}
        </button>
        {saved && <span className="text-sm text-green-400">✔ U ruajt</span>}
      </div>
    </div>
  );
}
