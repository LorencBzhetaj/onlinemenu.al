"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, inputClass } from "./modal";
import { useApiFetch } from "@/components/restaurant-context";
import type { AllergenDTO } from "@/lib/menu-types";

export function AllergenManager({ allergens, onClose }: { allergens: AllergenDTO[]; onClose: () => void }) {
  const router = useRouter();
  const api = useApiFetch();
  const [nameAl, setNameAl] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await api("/api/dashboard/allergens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameAl, nameEn, icon: icon || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Shtimi dështoi.");
      return;
    }
    setNameAl("");
    setNameEn("");
    setIcon("");
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Fshi këtë alergjen? Do të hiqet nga të gjitha pjatat.")) return;
    const res = await api(`/api/dashboard/allergens/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <Modal title="Alergjenët" onClose={onClose}>
      <div className="space-y-4">
        {allergens.length > 0 ? (
          <ul className="space-y-1.5">
            {allergens.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                <span>
                  {a.icon ? `${a.icon} ` : ""}
                  <span className="text-ink">{a.nameAl}</span>
                  <span className="text-muted"> · {a.nameEn}</span>
                </span>
                <button onClick={() => del(a.id)} className="text-red-600 hover:underline text-xs">
                  Fshi
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Ende s&apos;ka alergjenë. Shtoni një më poshtë.</p>
        )}

        <form onSubmit={add} className="space-y-3 border-t border-line pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Emri (Shqip)">
              <input className={inputClass} value={nameAl} onChange={(e) => setNameAl(e.target.value)} required />
            </Field>
            <Field label="Emri (Anglisht)">
              <input className={inputClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
            </Field>
            <Field label="Ikonë" hint="emoji, opsional">
              <input className={inputClass} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🥜" />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50">
              {busy ? "Duke shtuar…" : "Shto alergjen"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
