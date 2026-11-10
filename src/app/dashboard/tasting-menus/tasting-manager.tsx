"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, inputClass } from "@/components/menu/modal";
import { useApiFetch } from "@/components/restaurant-context";

export type CourseDTO = { titleAl: string; titleEn: string; descAl: string; descEn: string };
export type TastingDTO = { id: string; name: string; price: number; guestCount: number; courses: CourseDTO[] };

export function TastingManager({ initial }: { initial: TastingDTO[] }) {
  const [editing, setEditing] = useState<TastingDTO | "new" | null>(null);
  const router = useRouter();
  const api = useApiFetch();

  async function del(id: string) {
    if (!confirm("Fshi këtë menu degustuese?")) return;
    const res = await api(`/api/dashboard/tasting-menus/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <PageHeader title="Menu Degustuese" subtitle="Menu fikse me kurse, çmim dhe numër personash." />
        <button
          onClick={() => setEditing("new")}
          className="shrink-0 min-h-11 whitespace-nowrap rounded-full bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
        >
          + Menu e re
        </button>
      </div>

      {initial.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
          Ende s&apos;ka menu degustuese. Shto të parën.
        </div>
      ) : (
        <div className="space-y-3">
          {initial.map((m) => (
            <div key={m.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-lg text-ink">{m.name}</div>
                  <div className="text-sm text-muted">
                    {m.price} ALL · për {m.guestCount} persona · {m.courses.length} kurse
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setEditing(m)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary">
                    Ndrysho
                  </button>
                  <button onClick={() => del(m.id)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-red-600 hover:border-red-300">
                    Fshi
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TastingModal
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TastingModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: TastingDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editingMenu = !!initial;
  const api = useApiFetch();
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [guestCount, setGuestCount] = useState(initial ? String(initial.guestCount) : "2");
  const [courses, setCourses] = useState<CourseDTO[]>(initial?.courses ?? [{ titleAl: "", titleEn: "", descAl: "", descEn: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateCourse(i: number, patch: Partial<CourseDTO>) {
    setCourses((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addCourse() {
    setCourses((prev) => [...prev, { titleAl: "", titleEn: "", descAl: "", descEn: "" }]);
  }
  function removeCourse(i: number) {
    setCourses((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNum = Math.trunc(Number(price));
    const guests = Math.trunc(Number(guestCount));
    if (!name.trim()) return setError("Emri është i detyrueshëm.");
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError("Çmimi duhet të jetë numër > 0.");
    if (!Number.isFinite(guests) || guests <= 0) return setError("Numri i personave duhet > 0.");

    setSaving(true);
    const res = await api(
      editingMenu ? `/api/dashboard/tasting-menus/${initial!.id}` : "/api/dashboard/tasting-menus",
      {
        method: editingMenu ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price: priceNum, guestCount: guests, courses }),
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
    <Modal title={editingMenu ? "Ndrysho Menunë Degustuese" : "Menu Degustuese e Re"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Emri">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Çmimi (lek)">
            <input className={inputClass} type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Field label="Persona">
            <input className={inputClass} type="number" min={1} step={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} required />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Kurset</span>
            <button type="button" onClick={addCourse} className="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:border-primary hover:text-primary">
              + Kurs
            </button>
          </div>
          {courses.map((c, i) => (
            <div key={i} className="rounded-xl border border-line p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Kursi {i + 1}</span>
                {courses.length > 1 && (
                  <button type="button" onClick={() => removeCourse(i)} className="text-xs text-red-600 hover:underline">
                    Hiq
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className={inputClass} placeholder="Titulli (AL)" value={c.titleAl} onChange={(e) => updateCourse(i, { titleAl: e.target.value })} />
                <input className={inputClass} placeholder="Title (EN)" value={c.titleEn} onChange={(e) => updateCourse(i, { titleEn: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <textarea className={inputClass} rows={2} placeholder="Përshkrim (AL)" value={c.descAl} onChange={(e) => updateCourse(i, { descAl: e.target.value })} />
                <textarea className={inputClass} rows={2} placeholder="Description (EN)" value={c.descEn} onChange={(e) => updateCourse(i, { descEn: e.target.value })} />
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted hover:text-ink">
            Anulo
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Duke ruajtur…" : "Ruaj"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
