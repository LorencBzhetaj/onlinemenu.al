"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useApiFetch } from "@/components/restaurant-context";

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  _count: { reservations: number };
};

export function CustomersClient({ canDelete }: { canDelete: boolean }) {
  const api = useApiFetch();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api(`/api/dashboard/customers?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setRows(Array.isArray(d.customers) ? d.customers : []);
    } finally {
      setLoading(false);
    }
  }, [api, q]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function del(c: Customer) {
    if (c._count.reservations > 0) { alert("Klienti ka rezervime — historiku ruhet; fshirja nuk lejohet."); return; }
    if (!confirm(`Fshi klientin ${c.firstName} ${c.lastName}?`)) return;
    const r = await api(`/api/dashboard/customers/${c.id}`, { method: "DELETE" });
    if (r.ok) load();
    else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Dështoi."); }
  }

  return (
    <div>
      <PageHeader title="Klientët" subtitle="Klientët e këtij restoranti (të ndarë sipas tenant-it)." />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Kërko sipas emrit ose telefonit…"
        className="mb-4 w-full max-w-sm rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary"
      />
      {loading ? (
        <p className="text-muted">Duke ngarkuar…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">Asnjë klient.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="min-w-0">
                <div className="text-ink">{c.firstName} {c.lastName}</div>
                <div className="text-xs text-muted">
                  <a href={`tel:${c.phone}`} className="text-primary">{c.phone}</a>
                  {c.email ? ` · ${c.email}` : ""} · {c._count.reservations} rezervime
                </div>
              </div>
              {canDelete && (
                <button onClick={() => del(c)} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-red-600 hover:border-red-300 disabled:opacity-40" disabled={c._count.reservations > 0} title={c._count.reservations > 0 ? "Ka rezervime — nuk fshihet" : "Fshi"}>
                  Fshi
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
