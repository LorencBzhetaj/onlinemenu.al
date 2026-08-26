"use client";

import { useState } from "react";
import { Modal, Field, inputClass } from "./modal";
import { ImageUpload } from "./image-upload";
import type { ItemDTO } from "@/lib/menu-types";

type Parent = { categoryId?: string; subcategoryId?: string };

export function ItemModal({
  parent,
  initial,
  onClose,
  onSaved,
}: {
  parent: Parent;
  initial?: ItemDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!initial;
  const [nameAl, setNameAl] = useState(initial?.nameAl ?? "");
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [descAl, setDescAl] = useState(initial?.descAl ?? "");
  const [descEn, setDescEn] = useState(initial?.descEn ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [isChefPick, setIsChefPick] = useState(initial?.isChefPick ?? false);
  const [isDailyMenu, setIsDailyMenu] = useState(initial?.isDailyMenu ?? false);
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceNum = Math.trunc(Number(price));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError("Çmimi duhet të jetë numër i plotë më i madh se 0.");
      return;
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      nameAl,
      nameEn,
      descAl: descAl || null,
      descEn: descEn || null,
      price: priceNum,
      imageUrl,
      isChefPick,
      isDailyMenu,
      isVisible,
    };
    // Prindi dërgohet vetëm gjatë krijimit.
    if (!editing) {
      if (parent.categoryId) payload.categoryId = parent.categoryId;
      if (parent.subcategoryId) payload.subcategoryId = parent.subcategoryId;
    }

    const res = await fetch(
      editing ? `/api/menu-items/${initial!.id}` : "/api/menu-items",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <Modal title={editing ? "Ndrysho Artikullin" : "Artikull i Ri"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Emri (Shqip)">
            <input className={inputClass} value={nameAl} onChange={(e) => setNameAl(e.target.value)} required />
          </Field>
          <Field label="Emri (Anglisht)">
            <input className={inputClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Përshkrimi (Shqip)" hint="opsional">
            <textarea className={inputClass} rows={2} value={descAl} onChange={(e) => setDescAl(e.target.value)} />
          </Field>
          <Field label="Përshkrimi (Anglisht)" hint="opsional">
            <textarea className={inputClass} rows={2} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
          </Field>
        </div>

        <Field label="Çmimi (lek)">
          <input
            className={inputClass}
            type="number"
            min={1}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </Field>

        <Field label="Imazhi" hint="opsional">
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
        </Field>

        <div className="space-y-2 pt-1">
          <Checkbox checked={isChefPick} onChange={setIsChefPick} label="Rekomandim i Shefit" />
          <Checkbox checked={isDailyMenu} onChange={setIsDailyMenu} label="Menu Ditore" />
          <Checkbox checked={isVisible} onChange={setIsVisible} label="I dukshëm në menunë publike" />
        </div>

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

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-alpine-cream/80 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-alpine-gold"
      />
      {label}
    </label>
  );
}
