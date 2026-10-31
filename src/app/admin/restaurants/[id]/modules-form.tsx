"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ModuleView = { module: string; status: string; expiresAt: string | null };
const LABEL: Record<string, string> = { MENU: "Menu digjitale", BOOKING: "Rezervime (booking)" };

export function ModulesForm({ restaurantId, initial }: { restaurantId: string; initial: ModuleView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(module: string, status: string) {
    setError(null);
    setBusy(module);
    const res = await fetch(`/api/admin/restaurants/${restaurantId}/modules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, status }),
    });
    setBusy(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Dështoi."); return; }
    router.refresh();
  }

  const modules = ["MENU", "BOOKING"].map((m) => initial.find((x) => x.module === m) ?? { module: m, status: "disabled", expiresAt: null });

  return (
    <div className="space-y-3">
      {modules.map((m) => {
        const active = m.status === "active";
        return (
          <div key={m.module} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-4 py-3">
            <div>
              <div className="text-sm font-medium text-ink">{LABEL[m.module] ?? m.module}</div>
              <div className="text-xs text-muted">Statusi: {m.status}</div>
            </div>
            <button
              onClick={() => setStatus(m.module, active ? "disabled" : "active")}
              disabled={busy === m.module}
              className={`min-h-9 rounded-full px-4 text-xs font-medium transition disabled:opacity-50 ${
                active ? "border border-line text-muted hover:border-red-300 hover:text-red-600" : "bg-primary text-white hover:opacity-90"
              }`}
            >
              {busy === m.module ? "…" : active ? "Çaktivizo" : "Aktivizo"}
            </button>
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-muted">Aktivizim per-restorant (kurrë global). Ndryshimet regjistrohen në audit.</p>
    </div>
  );
}
