"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, Field, inputClass } from "@/components/menu/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useApiFetch } from "@/components/restaurant-context";

type Row = {
  id: string;
  status: string;
  partySize: number;
  startDateTime: string;
  source: string;
  notes: string | null;
  requestedArea: string;
  customer: { firstName: string; lastName: string; phone: string; email: string | null };
  table: { name: string; area: { name: string } | null } | null;
};

const STATUS_STYLE: Record<string, string> = {
  Confirmed: "bg-primary-soft text-primary",
  Seated: "bg-blue-50 text-blue-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-amber-50 text-amber-700",
  NoShow: "bg-red-50 text-red-600",
};
const NEXT_STATUSES = ["Seated", "Completed", "NoShow", "Cancelled"];
const STATUS_LABEL: Record<string, string> = { Confirmed: "Konfirmuar", Seated: "Në tryezë", Completed: "Përfunduar", NoShow: "S’erdhi", Cancelled: "Anuluar" };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ReservationsClient() {
  const api = useApiFetch();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [reschedule, setReschedule] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api(`/api/dashboard/reservations?date=${date}`);
      const d = await r.json();
      setRows(Array.isArray(d.reservations) ? d.reservations : []);
    } finally {
      setLoading(false);
    }
  }, [api, date]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    const r = await api(`/api/dashboard/reservations/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) load();
  }

  function shiftDay(delta: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Rezervime" subtitle="Rezervimet e ditës së zgjedhur." />
        <button onClick={() => setWalkIn(true)} className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark">
          + Walk-in / Telefon
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => shiftDay(-1)} className="min-h-11 rounded-lg border border-line px-3 text-sm hover:border-primary">←</button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
        <button onClick={() => shiftDay(1)} className="min-h-11 rounded-lg border border-line px-3 text-sm hover:border-primary">→</button>
        <button onClick={() => setDate(todayISO())} className="min-h-11 rounded-lg border border-line px-3 text-sm text-muted hover:border-primary">Sot</button>
      </div>

      {loading ? (
        <p className="text-muted">Duke ngarkuar…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">Asnjë rezervim për këtë datë.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-ink">{hhmm(r.startDateTime)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[r.status] ?? "bg-black/5 text-muted"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    <span className="text-xs text-muted">· {r.partySize} persona</span>
                  </div>
                  <div className="mt-1 text-sm text-ink">
                    {r.customer.firstName} {r.customer.lastName} · <a href={`tel:${r.customer.phone}`} className="text-primary">{r.customer.phone}</a>
                  </div>
                  <div className="text-xs text-muted">
                    {r.table ? `${r.table.name}${r.table.area ? ` · ${r.table.area.name}` : ""}` : "—"} · {r.source}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <select
                    value=""
                    onChange={(e) => e.target.value && setStatus(r.id, e.target.value)}
                    className="rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-muted"
                    aria-label="Ndrysho statusin"
                  >
                    <option value="">Status…</option>
                    {NEXT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
                  </select>
                  <button onClick={() => setReschedule(r)} className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:border-primary hover:text-primary">
                    Riplanifiko
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {walkIn && <WalkInModal date={date} onClose={() => setWalkIn(false)} onSaved={() => { setWalkIn(false); load(); }} />}
      {reschedule && <RescheduleModal row={reschedule} onClose={() => setReschedule(null)} onSaved={() => { setReschedule(null); load(); }} />}
    </div>
  );
}

function WalkInModal({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const api = useApiFetch();
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState("2");
  const [time, setTime] = useState("19:00");
  const [area, setArea] = useState("no_preference");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const [h, m] = time.split(":").map(Number);
    const [y, mo, d] = date.split("-").map(Number);
    const start = new Date(y, mo - 1, d, h, m, 0).toISOString();
    const r = await api("/api/dashboard/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, phone, partySize: Number(party), start, requestedArea: area, tableId: "any" }),
    });
    setBusy(false);
    if (!r.ok) { const d2 = await r.json().catch(() => ({})); setError(d2.error ?? "Dështoi."); return; }
    onSaved();
  }

  return (
    <Modal title="Walk-in / Telefon" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Emri"><input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></Field>
        <Field label="Telefoni"><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Persona"><input className={inputClass} type="number" min={1} value={party} onChange={(e) => setParty(e.target.value)} /></Field>
          <Field label="Ora"><input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field label="Zona">
            <select className={inputClass} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="no_preference">Pa pref.</option>
              <option value="indoor">Brenda</option>
              <option value="outdoor">Jashtë</option>
            </select>
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted">Anulo</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-2 font-medium text-white disabled:opacity-50">{busy ? "Duke ruajtur…" : "Krijo"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RescheduleModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const api = useApiFetch();
  const [date, setDate] = useState(row.startDateTime.slice(0, 10));
  const [slots, setSlots] = useState<{ time: string; start: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadSlots() {
    setLoading(true);
    setError(null);
    try {
      const r = await api(`/api/dashboard/booking/availability?date=${date}&partySize=${row.partySize}`);
      const d = await r.json();
      setSlots(Array.isArray(d.slots) ? d.slots : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadSlots(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date]);

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const r = await api(`/api/dashboard/reservations/${row.id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: selected }),
    });
    setBusy(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? "Dështoi."); return; }
    onSaved();
  }

  return (
    <Modal title={`Riplanifiko · ${row.customer.firstName}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Data e re"><input className={inputClass} type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelected(null); }} /></Field>
        {loading ? <p className="text-sm text-muted">Duke ngarkuar…</p> : slots.length === 0 ? (
          <p className="text-sm text-muted">Nuk ka orë të lira për këtë datë.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {slots.map((s) => (
              <button key={s.start} type="button" onClick={() => setSelected(s.start)} className={`min-h-10 rounded-lg border text-sm ${selected === s.start ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:border-primary"}`}>{s.time}</button>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted">Anulo</button>
          <button type="button" onClick={save} disabled={busy || !selected} className="rounded-lg bg-primary px-5 py-2 font-medium text-white disabled:opacity-50">{busy ? "Duke ruajtur…" : "Riplanifiko"}</button>
        </div>
      </div>
    </Modal>
  );
}
