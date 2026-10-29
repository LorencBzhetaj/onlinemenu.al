"use client";

import { useState } from "react";
import { Modal, Field, inputClass } from "./modal";
import { CATEGORY_ICON_OPTIONS, CategoryIcon } from "@/lib/menu-icons";
import { formatSchedule } from "./schedule-format";
import { useApiFetch } from "@/components/restaurant-context";
import type { CategoryDTO, ScheduleDTO } from "@/lib/menu-types";

export function CategoryModal({
  initial,
  schedules,
  onClose,
  onSaved,
}: {
  initial?: CategoryDTO;
  schedules: ScheduleDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!initial;
  const [nameAl, setNameAl] = useState(initial?.nameAl ?? "");
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "other");
  const [scheduleId, setScheduleId] = useState<string>(initial?.scheduleId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const api = useApiFetch();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await api(
      editing ? `/api/categories/${initial!.id}` : "/api/categories",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameAl, nameEn, icon, scheduleId: scheduleId || null }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Ruajtja dështoi.");
      return;
    }
    onSaved();
  }

  return (
    <Modal title={editing ? "Ndrysho Kategorinë" : "Kategori e Re"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Emri (Shqip)">
          <input className={inputClass} value={nameAl} onChange={(e) => setNameAl(e.target.value)} required />
        </Field>
        <Field label="Emri (Anglisht)">
          <input className={inputClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
        </Field>

        <Field label="Ikona">
          <div className="grid grid-cols-4 gap-2">
            {CATEGORY_ICON_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.key}
                onClick={() => setIcon(opt.key)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition ${
                  icon === opt.key
                    ? "border-primary text-primary"
                    : "border-line text-muted hover:border-line"
                }`}
              >
                <CategoryIcon icon={opt.key} />
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {schedules.length > 0 && (
          <Field label="Orari i menusë" hint="opsional — kategoria shfaqet publikisht vetëm brenda orarit">
            <select className={inputClass} value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
              <option value="">Gjithmonë e dukshme</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {formatSchedule(s)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted hover:text-ink">
            Anulo
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Duke ruajtur…" : "Ruaj"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
