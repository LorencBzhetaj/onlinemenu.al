"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, inputClass } from "@/components/menu/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useApiFetch } from "@/components/restaurant-context";

const DAYS = ["E Diel", "E Hënë", "E Martë", "E Mërkurë", "E Enjte", "E Premte", "E Shtunë"];

type HourRow = { dayOfWeek: number; startTime: string; endTime: string; lastBookingTime: string | null; isActive: boolean };
type Closure = { id: string; startDate: string; endDate: string; reason: string | null };
type SlotLimit = { id: string; time: string; maxReservations: number; maxCovers: number | null; dayOfWeek: number | null; areaKind: string | null };
type Settings = { turnDurationMinutes: number; bookingInterval: number; seatingBuffer: number; maxPartySize: number; maxReservationsPerSlot: number; maxCoversPerSlot: number; timezone: string };

export function HoursClient() {
  const api = useApiFetch();
  const [hours, setHours] = useState<HourRow[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [limits, setLimits] = useState<SlotLimit[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savedHours, setSavedHours] = useState(false);

  const load = useCallback(async () => {
    const r = await api("/api/dashboard/booking/config");
    const d = await r.json();
    const byDay = new Map<number, HourRow>((d.hours ?? []).map((h: HourRow) => [h.dayOfWeek, h]));
    setHours(DAYS.map((_, i) => byDay.get(i) ?? { dayOfWeek: i, startTime: "12:00", endTime: "23:00", lastBookingTime: null, isActive: false }));
    setClosures(d.closures ?? []);
    setLimits(d.slotLimits ?? []);
    setSettings(d.settings ?? null);
  }, [api]);
  useEffect(() => { load(); }, [load]);

  function updateHour(i: number, patch: Partial<HourRow>) {
    setHours((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }
  async function saveHours() {
    const payload = hours.filter((h) => h.isActive).map((h) => ({ dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime, lastBookingTime: h.lastBookingTime || null, isActive: true }));
    const r = await api("/api/dashboard/booking/hours", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours: payload }) });
    if (r.ok) { setSavedHours(true); setTimeout(() => setSavedHours(false), 1800); load(); }
  }

  async function addClosure(form: HTMLFormElement) {
    const fd = new FormData(form);
    const r = await api("/api/dashboard/booking/closures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startDate: fd.get("start"), endDate: fd.get("end") || fd.get("start"), reason: fd.get("reason") }) });
    if (r.ok) { form.reset(); load(); }
  }
  async function delClosure(id: string) { const r = await api(`/api/dashboard/booking/closures/${id}`, { method: "DELETE" }); if (r.ok) load(); }

  async function addLimit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const r = await api("/api/dashboard/booking/slot-limits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ time: fd.get("time"), maxReservations: fd.get("maxRes"), maxCovers: fd.get("maxCovers"), areaKind: fd.get("areaKind") }) });
    if (r.ok) { form.reset(); load(); }
  }
  async function delLimit(id: string) { const r = await api(`/api/dashboard/booking/slot-limits/${id}`, { method: "DELETE" }); if (r.ok) load(); }

  async function saveSettings(patch: Partial<Settings>) {
    const r = await api("/api/dashboard/booking/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (r.ok) load();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Orari & rregullat" subtitle="Orari i hapjes, mbylljet, kufijtë dhe politikat e rezervimit." />

      {/* ORARI */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Orari i hapjes</h2>
          <button onClick={saveHours} className="rounded-full bg-primary px-4 py-1.5 text-sm text-white">{savedHours ? "✔ Ruajtur" : "Ruaj orarin"}</button>
        </div>
        <div className="space-y-2">
          {hours.map((h, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex w-28 items-center gap-2"><input type="checkbox" checked={h.isActive} onChange={(e) => updateHour(i, { isActive: e.target.checked })} className="accent-primary" />{DAYS[i]}</label>
              <input type="time" value={h.startTime} disabled={!h.isActive} onChange={(e) => updateHour(i, { startTime: e.target.value })} className="rounded-lg border border-line bg-canvas px-2 py-1 disabled:opacity-40" />
              <span className="text-muted">–</span>
              <input type="time" value={h.endTime} disabled={!h.isActive} onChange={(e) => updateHour(i, { endTime: e.target.value })} className="rounded-lg border border-line bg-canvas px-2 py-1 disabled:opacity-40" />
              <input type="time" value={h.lastBookingTime ?? ""} disabled={!h.isActive} onChange={(e) => updateHour(i, { lastBookingTime: e.target.value || null })} placeholder="fundi" title="Ora e fundit e rezervimit" className="rounded-lg border border-line bg-canvas px-2 py-1 disabled:opacity-40" />
            </div>
          ))}
        </div>
      </section>

      {/* MBYLLJET */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display text-lg text-ink">Mbyllje (pushime / evente)</h2>
        <div className="mb-3 space-y-1.5">
          {closures.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
              <span>{c.startDate.slice(0, 10)} → {c.endDate.slice(0, 10)}{c.reason ? ` · ${c.reason}` : ""}</span>
              <button onClick={() => delClosure(c.id)} className="text-xs text-red-600">Fshi</button>
            </div>
          ))}
          {closures.length === 0 && <p className="text-sm text-muted">Pa mbyllje.</p>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); addClosure(e.currentTarget); }} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">Nga<input name="start" type="date" required className="block rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-muted">Deri<input name="end" type="date" className="block rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm" /></label>
          <input name="reason" placeholder="Arsyeja" className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm" />
          <button className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary">Shto</button>
        </form>
      </section>

      {/* KUFIJTË E SLOT-EVE */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display text-lg text-ink">Kufij për slot</h2>
        <div className="mb-3 space-y-1.5">
          {limits.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
              <span>{l.time} · max {l.maxReservations} rezervime{l.maxCovers ? ` / ${l.maxCovers} mysafirë` : ""}{l.areaKind ? ` · ${l.areaKind}` : ""}</span>
              <button onClick={() => delLimit(l.id)} className="text-xs text-red-600">Fshi</button>
            </div>
          ))}
          {limits.length === 0 && <p className="text-sm text-muted">Pa kufij (kufizon vetëm numri i tavolinave).</p>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); addLimit(e.currentTarget); }} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">Ora<input name="time" type="time" required className="block rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-muted">Max rezervime<input name="maxRes" type="number" min={1} required className="block w-24 rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-muted">Max mysafirë<input name="maxCovers" type="number" min={0} className="block w-24 rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm" /></label>
          <select name="areaKind" className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm"><option value="">I gjithë</option><option value="indoor">Brenda</option><option value="outdoor">Jashtë</option></select>
          <button className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary">Shto</button>
        </form>
      </section>

      {/* POLITIKAT */}
      {settings && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-display text-lg text-ink">Politikat e rezervimit</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumField label="Kohëzgjatja (min)" value={settings.turnDurationMinutes} onSave={(v) => saveSettings({ turnDurationMinutes: v })} />
            <NumField label="Interval slot (min)" value={settings.bookingInterval} onSave={(v) => saveSettings({ bookingInterval: v })} />
            <NumField label="Buffer (min)" value={settings.seatingBuffer} onSave={(v) => saveSettings({ seatingBuffer: v })} />
            <NumField label="Grup maksimal" value={settings.maxPartySize} onSave={(v) => saveSettings({ maxPartySize: v })} />
            <NumField label="Max rezervime/slot" value={settings.maxReservationsPerSlot} onSave={(v) => saveSettings({ maxReservationsPerSlot: v })} />
            <NumField label="Max mysafirë/slot" value={settings.maxCoversPerSlot} onSave={(v) => saveSettings({ maxCoversPerSlot: v })} />
          </div>
          <p className="mt-2 text-xs text-muted">0 = pa kufi. Zona kohore: {settings.timezone}.</p>
        </section>
      )}
    </div>
  );
}

function NumField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <Field label={label}>
      <input
        className={inputClass}
        type="number"
        min={0}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = Number(v); if (Number.isFinite(n) && n !== value) onSave(Math.trunc(n)); }}
      />
    </Field>
  );
}
