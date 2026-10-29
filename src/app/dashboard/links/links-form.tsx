"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { useApiFetch } from "@/components/restaurant-context";
import { LINK_META, type LinkType } from "@/modules/restaurants/external-links";

type Row = { type: LinkType; url: string; enabled: boolean; exists: boolean };

export function LinksForm({ initial }: { initial: Row[] }) {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Lidhje të jashtme"
        subtitle="Wolt, Google Maps, Instagram dhe faqja zyrtare. Hapen në profilin publik; serveri s'merr të dhëna prej tyre."
      />
      <div className="space-y-3">
        {initial.map((row) => (
          <LinkRow key={row.type} row={row} />
        ))}
      </div>
    </div>
  );
}

function LinkRow({ row }: { row: Row }) {
  const router = useRouter();
  const api = useApiFetch();
  const meta = LINK_META[row.type];
  const [url, setUrl] = useState(row.url);
  const [enabled, setEnabled] = useState(row.enabled);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    const res = await api("/api/dashboard/links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: row.type, url, enabled }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Ruajtja dështoi.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await api("/api/dashboard/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: row.type }),
    });
    setBusy(false);
    if (res.ok) {
      setUrl("");
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-ink">{meta.label}</div>
          <div className="text-xs text-muted">{meta.hint}</div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
          Aktive
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-field border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-primary"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          inputMode="url"
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={busy || !url.trim()}
            className="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saved ? "✔ Ruajtur" : "Ruaj"}
          </button>
          {row.exists && (
            <button onClick={remove} disabled={busy} className="min-h-11 rounded-full border border-line px-4 text-sm text-red-600 hover:border-red-300">
              Fshi
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
