"use client";

import { useState } from "react";
import { Modal, Field, inputClass } from "./modal";
import { CATEGORY_ICON_OPTIONS, CategoryIcon } from "@/lib/menu-icons";
import type { CategoryDTO } from "@/lib/menu-types";

export function CategoryModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: CategoryDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!initial;
  const [nameAl, setNameAl] = useState(initial?.nameAl ?? "");
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "other");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(
      editing ? `/api/categories/${initial!.id}` : "/api/categories",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameAl, nameEn, icon }),
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
                    ? "border-alpine-gold text-alpine-gold"
                    : "border-alpine-cream/15 text-alpine-cream/60 hover:border-alpine-cream/40"
                }`}
              >
                <CategoryIcon icon={opt.key} />
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-alpine-cream/70 hover:text-alpine-cream">
            Anulo
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-alpine-gold px-5 py-2 text-midnight font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Duke ruajtur…" : "Ruaj"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
