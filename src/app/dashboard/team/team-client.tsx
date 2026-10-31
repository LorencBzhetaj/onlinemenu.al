"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useApiFetch } from "@/components/restaurant-context";

type Member = { userId: string; email: string; role: string; status: string; isSelf: boolean };
type Invite = { id: string; email: string; role: string; expiresAt: string; expired: boolean };

const ROLE_LABEL: Record<string, string> = { OWNER: "Pronar", MANAGER: "Menaxher", STAFF: "Staf" };
const INVITE_ERRORS: Record<string, string> = {
  bad_role: "Rol i pavlefshëm.",
  bad_email: "Email i pavlefshëm.",
  already_member: "Ky email është tashmë anëtar aktiv.",
  already_invited: "Ka tashmë një ftesë aktive.",
};

export function TeamClient() {
  const api = useApiFetch();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api("/api/dashboard/team");
      const d = await r.json();
      setMembers(Array.isArray(d.members) ? d.members : []);
      setInvites(Array.isArray(d.invitations) ? d.invitations : []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    setBusy(true);
    try {
      const r = await api("/api/dashboard/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setError(INVITE_ERRORS[d.error] ?? "Ftesa dështoi."); return; }
      setInviteUrl(d.inviteUrl);
      setEmail("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function revokeMember(m: Member) {
    if (!confirm(`Revoko aksesin e ${m.email}?`)) return;
    const r = await api("/api/dashboard/team/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: m.userId }),
    });
    if (r.ok) load();
    else { const d = await r.json().catch(() => ({})); alert(d.error === "cannot_revoke_owner" ? "Pronari nuk mund të revokohet." : "Dështoi."); }
  }

  async function revokeInvite(i: Invite) {
    const r = await api("/api/dashboard/team/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId: i.id }),
    });
    if (r.ok) load();
  }

  return (
    <div>
      <PageHeader title="Ekipi" subtitle="Fto menaxherë dhe staf, menaxho rolet dhe revoko aksesin. Pronari mbetet gjithmonë." />

      {/* Fto */}
      <form onSubmit={invite} className="mb-6 rounded-card-sm border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Email</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="personi@example.com"
              className="min-h-11 w-full rounded-field border border-line bg-canvas px-3 text-sm outline-none focus:border-primary/60"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Roli</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="min-h-11 rounded-field border border-line bg-canvas px-3 text-sm outline-none focus:border-primary/60">
              <option value="STAFF">Staf</option>
              <option value="MANAGER">Menaxher</option>
            </select>
          </label>
          <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50">
            {busy ? "Duke ftuar…" : "Dërgo ftesë"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {inviteUrl && (
          <div className="mt-3 rounded-field border border-primary/30 bg-primary-soft p-3 text-sm">
            <p className="mb-1 font-medium text-primary">Ftesa u krijua. Ndaje këtë lidhje (skadon për 7 ditë):</p>
            <code className="block break-all text-xs text-ink">{inviteUrl}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(inviteUrl)} className="mt-2 text-xs font-medium text-primary hover:underline">Kopjo lidhjen</button>
          </div>
        )}
      </form>

      {loading ? (
        <p className="text-muted">Duke ngarkuar…</p>
      ) : (
        <>
          <h2 className="mb-2 font-display text-lg text-ink">Anëtarët</h2>
          <div className="mb-8 overflow-hidden rounded-card-sm border border-line bg-surface shadow-card">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">{m.email}{m.isSelf && <span className="text-muted"> (ti)</span>}</div>
                  <div className="text-xs text-muted">{ROLE_LABEL[m.role] ?? m.role}{m.status !== "active" && ` · ${m.status}`}</div>
                </div>
                {m.role !== "OWNER" && m.status === "active" && (
                  <button onClick={() => revokeMember(m)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-red-300 hover:text-red-600">Revoko</button>
                )}
                {m.role === "OWNER" && <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs text-primary">Pronar</span>}
              </div>
            ))}
          </div>

          <h2 className="mb-2 font-display text-lg text-ink">Ftesa në pritje</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted">Asnjë ftesë aktive.</p>
          ) : (
            <div className="overflow-hidden rounded-card-sm border border-line bg-surface shadow-card">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{i.email}</div>
                    <div className="text-xs text-muted">{ROLE_LABEL[i.role] ?? i.role} · {i.expired ? "e skaduar" : `skadon ${new Date(i.expiresAt).toLocaleDateString("sq-AL")}`}</div>
                  </div>
                  <button onClick={() => revokeInvite(i)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-red-300 hover:text-red-600">Anulo</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
