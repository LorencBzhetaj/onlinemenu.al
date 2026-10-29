"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field, inputClass } from "./modal";
import { useApiFetch } from "@/components/restaurant-context";
import { DAY_OPTIONS, formatSchedule, hhmmToMinutes } from "./schedule-format";
import type { ScheduleDTO } from "@/lib/menu-types";

export function ScheduleManager({ schedules, onClose }: { schedules: ScheduleDTO[]; onClose: () => void }) {
  const router = useRouter();
  const api = useApiFetch();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("11:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const startMinutes = hhmmToMinutes(start);
    const endMinutes = hhmmToMinutes(end);
    if (startMinutes === null || endMinutes === null) {
      setError("Orari duhet në formatin HH:MM.");
      return;
    }
    setBusy(true);
    const res = await api("/api/dashboard/menu-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, days, startMinutes, endMinutes }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Shtimi dështoi.");
      return;
    }
    setLabel("");
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Fshi këtë orar? Kategoritë e lidhura do të bëhen gjithmonë të dukshme.")) return;
    const res = await api(`/api/dashboard/menu-schedules/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <Modal title="Oraret e menusë" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Oraret kufizojnë kur një kategori shfaqet në menunë publike (p.sh. mëngjesi 07:00–11:00).
          Lidhi me një kategori te forma e kategorisë.
        </p>

        {schedules.length > 0 ? (
          <ul className="space-y-1.5">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                <span>
                  <span className="text-ink font-medium">{s.label}</span>
                  <span className="text-muted"> · {formatSchedule(s)}</span>
                </span>
                <button onClick={() => del(s.id)} className="text-red-600 hover:underline text-xs">
                  Fshi
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Ende s&apos;ka orare.</p>
        )}

        <form onSubmit={add} className="space-y-3 border-t border-line pt-4">
          <Field label="Emri i orarit">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Mëngjesi" required />
          </Field>

          <Field label="Ditët">
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((d) => {
                const on = days.includes(d.value);
                return (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      on ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:border-primary"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nga">
              <input className={inputClass} type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </Field>
            <Field label="Deri">
              <input className={inputClass} type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </Field>
          </div>

          <p className="text-xs text-muted">Për dritare që kalojnë mesnatën, vendos “Deri” më të vogël se “Nga” (p.sh. 22:00–02:00).</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50">
              {busy ? "Duke shtuar…" : "Shto orar"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
