"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, Field, inputClass } from "@/components/menu/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useApiFetch } from "@/components/restaurant-context";

type Area = { id: string; name: string; kind: string; isOpen: boolean };
type Table = { id: string; name: string; seats: number; section: string; areaId: string | null; isActive: boolean; x: number; y: number; w: number; h: number };
type Combo = { id: string; name: string; areaId: string; maxSeats: number; members: { tableId: string }[] };
type Config = { areas: Area[]; tables: Table[]; combinations: Combo[] };

export function TablesClient() {
  const api = useApiFetch();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [tableModal, setTableModal] = useState<Table | "new" | null>(null);
  const [comboModal, setComboModal] = useState(false);

  const load = useCallback(async () => {
    const r = await api("/api/dashboard/booking/config");
    const d = await r.json();
    setCfg({ areas: d.areas ?? [], tables: d.tables ?? [], combinations: d.combinations ?? [] });
  }, [api]);
  useEffect(() => { load(); }, [load]);

  async function addArea() {
    const name = prompt("Emri i zonës (p.sh. Brenda, Terrasë):");
    if (!name) return;
    const kind = confirm("A është zonë e jashtme (OK = Jashtë, Anulo = Brenda)?") ? "outdoor" : "indoor";
    const r = await api("/api/dashboard/booking/areas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, kind }) });
    if (r.ok) load();
  }
  async function toggleArea(a: Area) {
    const r = await api(`/api/dashboard/booking/areas/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isOpen: !a.isOpen }) });
    if (r.ok) load();
  }
  async function delArea(a: Area) {
    if (!confirm(`Fshi zonën "${a.name}"?`)) return;
    const r = await api(`/api/dashboard/booking/areas/${a.id}`, { method: "DELETE" });
    if (r.ok) load(); else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Dështoi."); }
  }
  async function delTable(t: Table) {
    const r = await api(`/api/dashboard/booking/tables/${t.id}`, { method: "DELETE" });
    if (r.ok) load(); else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Dështoi."); }
  }
  async function toggleTable(t: Table) {
    const r = await api(`/api/dashboard/booking/tables/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !t.isActive }) });
    if (r.ok) load();
  }
  async function delCombo(c: Combo) {
    if (!confirm(`Fshi kombinimin "${c.name}"?`)) return;
    const r = await api(`/api/dashboard/booking/combinations/${c.id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  if (!cfg) return <p className="text-muted">Duke ngarkuar…</p>;
  const areaName = (id: string | null) => cfg.areas.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-8">
      <PageHeader title="Salla" subtitle="Zonat, tavolinat, kombinimet dhe plani i sallës." />

      {/* ZONAT */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Zonat</h2>
          <button onClick={addArea} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary">+ Zonë</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cfg.areas.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
              <span className="text-ink">{a.name}</span>
              <span className="text-xs text-muted">{a.kind === "outdoor" ? "jashtë" : "brenda"}</span>
              <button onClick={() => toggleArea(a)} className={`rounded-full px-2 py-0.5 text-xs ${a.isOpen ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{a.isOpen ? "Hapur" : "Mbyllur"}</button>
              <button onClick={() => delArea(a)} className="text-xs text-red-600">✕</button>
            </div>
          ))}
          {cfg.areas.length === 0 && <p className="text-sm text-muted">Shto një zonë për të filluar.</p>}
        </div>
      </section>

      {/* TAVOLINAT */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Tavolinat</h2>
          <button onClick={() => setTableModal("new")} disabled={cfg.areas.length === 0} className="rounded-full bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-40">+ Tavolinë</button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cfg.tables.map((t) => (
            <div key={t.id} className={`flex items-center justify-between rounded-xl border border-line bg-surface p-3 ${t.isActive ? "" : "opacity-60"}`}>
              <div>
                <span className="text-ink">{t.name}</span>
                <span className="text-xs text-muted"> · {t.seats} vende · {areaName(t.areaId)}{t.isActive ? "" : " · joaktive"}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setTableModal(t)} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-black/5">✎</button>
                <button onClick={() => toggleTable(t)} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-black/5" title={t.isActive ? "Çaktivizo" : "Aktivizo"}>{t.isActive ? "⏸" : "▶"}</button>
                <button onClick={() => delTable(t)} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-black/5">🗑</button>
              </div>
            </div>
          ))}
          {cfg.tables.length === 0 && <p className="text-sm text-muted">Pa tavolina ende.</p>}
        </div>
      </section>

      {/* PLANI I SALLËS (preview mbi rrjetë 12×8) */}
      {cfg.tables.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg text-ink">Plani i sallës</h2>
          <FloorPreview tables={cfg.tables} />
          <p className="mt-2 text-xs text-muted">Pozicioni (x, y, gjerësi, lartësi) editohet te forma e tavolinës.</p>
        </section>
      )}

      {/* KOMBINIMET */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Kombinime tavolinash</h2>
          <button onClick={() => setComboModal(true)} disabled={cfg.tables.length < 2} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary disabled:opacity-40">+ Kombinim</button>
        </div>
        <div className="space-y-2">
          {cfg.combinations.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 text-sm">
              <span><span className="text-ink">{c.name}</span> <span className="text-xs text-muted">· max {c.maxSeats} · {areaName(c.areaId)} · {c.members.length} tavolina</span></span>
              <button onClick={() => delCombo(c)} className="text-xs text-red-600">Fshi</button>
            </div>
          ))}
          {cfg.combinations.length === 0 && <p className="text-sm text-muted">Pa kombinime.</p>}
        </div>
      </section>

      {tableModal && <TableModal table={tableModal === "new" ? null : tableModal} areas={cfg.areas} onClose={() => setTableModal(null)} onSaved={() => { setTableModal(null); load(); }} />}
      {comboModal && <ComboModal areas={cfg.areas} tables={cfg.tables} onClose={() => setComboModal(false)} onSaved={() => { setComboModal(false); load(); }} />}
    </div>
  );
}

function FloorPreview({ tables }: { tables: Table[] }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-canvas" style={{ aspectRatio: "12 / 8" }}>
      {tables.map((t) => (
        <div
          key={t.id}
          className={`absolute grid place-items-center rounded-lg border text-[0.6rem] ${t.isActive ? "border-primary/40 bg-primary-soft text-primary" : "border-line bg-black/5 text-muted"}`}
          style={{ left: `${(t.x / 12) * 100}%`, top: `${(t.y / 8) * 100}%`, width: `${(t.w / 12) * 100}%`, height: `${(t.h / 8) * 100}%` }}
          title={`${t.name} · ${t.seats}`}
        >
          {t.name}
        </div>
      ))}
    </div>
  );
}

function TableModal({ table, areas, onClose, onSaved }: { table: Table | null; areas: Area[]; onClose: () => void; onSaved: () => void }) {
  const api = useApiFetch();
  const editing = !!table;
  const [name, setName] = useState(table?.name ?? "");
  const [seats, setSeats] = useState(String(table?.seats ?? 2));
  const [areaId, setAreaId] = useState(table?.areaId ?? areas[0]?.id ?? "");
  const [section, setSection] = useState(table?.section ?? "");
  const [x, setX] = useState(String(table?.x ?? 0));
  const [y, setY] = useState(String(table?.y ?? 0));
  const [w, setW] = useState(String(table?.w ?? 2));
  const [h, setH] = useState(String(table?.h ?? 2));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { name, seats: Number(seats), areaId, section, x: Number(x), y: Number(y), w: Number(w), h: Number(h) };
    const r = await api(editing ? `/api/dashboard/booking/tables/${table!.id}` : "/api/dashboard/booking/tables", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? "Dështoi."); return; }
    onSaved();
  }

  return (
    <Modal title={editing ? "Ndrysho tavolinën" : "Tavolinë e re"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Emri"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Vende"><input className={inputClass} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} required /></Field>
        </div>
        <Field label="Zona">
          <select className={inputClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Seksion" hint="opsional"><input className={inputClass} value={section} onChange={(e) => setSection(e.target.value)} /></Field>
        <div>
          <span className="mb-1 block text-sm text-muted">Pozicioni në plan (rrjetë 12×8)</span>
          <div className="grid grid-cols-4 gap-2">
            <Field label="x"><input className={inputClass} type="number" min={0} max={12} value={x} onChange={(e) => setX(e.target.value)} /></Field>
            <Field label="y"><input className={inputClass} type="number" min={0} max={8} value={y} onChange={(e) => setY(e.target.value)} /></Field>
            <Field label="gjer."><input className={inputClass} type="number" min={1} max={12} value={w} onChange={(e) => setW(e.target.value)} /></Field>
            <Field label="lart."><input className={inputClass} type="number" min={1} max={8} value={h} onChange={(e) => setH(e.target.value)} /></Field>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted">Anulo</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-2 font-medium text-white disabled:opacity-50">{busy ? "Duke ruajtur…" : "Ruaj"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ComboModal({ areas, tables, onClose, onSaved }: { areas: Area[]; tables: Table[]; onClose: () => void; onSaved: () => void }) {
  const api = useApiFetch();
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [maxSeats, setMaxSeats] = useState("4");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const areaTables = tables.filter((t) => t.areaId === areaId);

  function toggle(id: string) { setMembers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/api/dashboard/booking/combinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, areaId, maxSeats: Number(maxSeats), memberTableIds: members }),
    });
    setBusy(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? "Dështoi."); return; }
    onSaved();
  }

  return (
    <Modal title="Kombinim i ri" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Emri"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Zona">
            <select className={inputClass} value={areaId} onChange={(e) => { setAreaId(e.target.value); setMembers([]); }}>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Max persona"><input className={inputClass} type="number" min={2} value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)} /></Field>
        </div>
        <Field label="Tavolinat (≥2, në të njëjtën zonë)">
          <div className="flex flex-wrap gap-2">
            {areaTables.map((t) => (
              <button type="button" key={t.id} onClick={() => toggle(t.id)} className={`rounded-full border px-3 py-1.5 text-xs ${members.includes(t.id) ? "border-primary bg-primary-soft text-primary" : "border-line text-muted"}`}>{t.name}</button>
            ))}
            {areaTables.length === 0 && <span className="text-xs text-muted">Pa tavolina në këtë zonë.</span>}
          </div>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-muted">Anulo</button>
          <button type="submit" disabled={busy || members.length < 2} className="rounded-lg bg-primary px-5 py-2 font-medium text-white disabled:opacity-50">{busy ? "Duke ruajtur…" : "Krijo"}</button>
        </div>
      </form>
    </Modal>
  );
}
