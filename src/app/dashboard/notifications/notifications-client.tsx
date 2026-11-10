"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { inputClass } from "@/components/menu/modal";
import { useApiFetch } from "@/components/restaurant-context";

type Recipient = { id: string; channel: "Email" | "WhatsApp"; address: string; label: string | null; enabled: boolean; verified: boolean; consent: boolean };
type Job = { id: string; type: string; channel: string; recipient: string; status: string; attempts: number; lastError: string | null; createdAt: string };
type Data = { settings: { emailEnabled: boolean; whatsappEnabled: boolean }; recipients: Recipient[]; recent: Job[] };

const TYPE_LABEL: Record<string, string> = {
  BusinessNewBooking: "Rezervim i ri",
  BusinessReschedule: "Ndryshim orari",
  BusinessCancellation: "Anulim",
};
const STATUS_LABEL: Record<string, string> = {
  Pending: "Në pritje",
  Sending: "Duke u dërguar",
  Sent: "U dërgua",
  Simulated: "Simuluar (pa dërgim real)",
  Failed: "Dështoi — do riprovohet",
  Dead: "Dështoi përfundimisht",
};

export function NotificationsClient() {
  const api = useApiFetch();
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [channel, setChannel] = useState<"Email" | "WhatsApp">("Email");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [consent, setConsent] = useState(false);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [devCodes, setDevCodes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await api("/api/dashboard/notifications");
    if (r.ok) setData(await r.json());
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setErr(null);
    setMsg(null);
    const r = await api("/api/dashboard/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) setErr(d.error ?? "Veprimi dështoi.");
    return { ok: r.ok && d.ok !== false, d };
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { ok, d } = await post({ action: "add", channel, address, label, consent });
    if (ok) {
      setMsg(d.simulated ? "Marrësi u shtua. Dërgimi është i simuluar: përdorni kodin e treguar më poshtë." : "Marrësi u shtua. Vendosni kodin që mori.");
      if (d.devCode) setDevCodes((c) => ({ ...c, [d.id]: d.devCode }));
      setAddress("");
      setLabel("");
      setConsent(false);
      await load();
    }
  }

  if (!data) return <div className="text-muted">Duke ngarkuar…</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Njoftime rezervimesh" subtitle="Kush njoftohet kur ka rezervim të ri, ndryshim orari ose anulim nga klienti." />

      {msg && <p className="rounded-lg border border-line bg-surface p-3 text-sm" role="status">{msg}</p>}
      {err && <p className="rounded-lg border border-red-400/40 bg-red-50 p-3 text-sm text-red-700" role="alert">{err}</p>}

      <section className="rounded-xl border border-line bg-surface p-5 space-y-3" aria-labelledby="h-kanalet">
        <h2 id="h-kanalet" className="font-heading text-xl">Kanalet</h2>
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" aria-label="Kanali Email për njoftimet e rezervimeve" checked={data.settings.emailEnabled} onChange={async (e) => { await post({ action: "channels", emailEnabled: e.target.checked }); await load(); }} />
          <span>Email</span>
        </label>
        <label className="flex items-center gap-3 min-h-11">
          <input type="checkbox" aria-label="Kanali WhatsApp për njoftimet e rezervimeve (i simuluar)" checked={data.settings.whatsappEnabled} onChange={async (e) => { await post({ action: "channels", whatsappEnabled: e.target.checked }); await load(); }} />
          <span>WhatsApp <span className="text-muted text-sm">(i simuluar derisa të konfigurohet integrimi zyrtar i biznesit)</span></span>
        </label>
        <p className="text-xs text-muted">Pa marrës email të verifikuar, njoftimi shkon te email-i i pronarit. Mesazhi ka datën, orën, personat, referencën dhe lidhjen te paneli (kërkon hyrje); kurrë lidhjen e anulimit të klientit.</p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 space-y-4" aria-labelledby="h-marresit">
        <h2 id="h-marresit" className="font-heading text-xl">Marrësit</h2>
        {data.recipients.length === 0 && <p className="text-muted text-sm">Ende s’ka marrës.</p>}
        <ul className="divide-y divide-line">
          {data.recipients.map((r) => (
            <li key={r.id} className="py-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{r.channel}</strong> · {r.address} {r.label ? `· ${r.label}` : ""}{" "}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${r.verified ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-800"}`}>{r.verified ? "i verifikuar" : "pa verifikuar"}</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 text-sm min-h-11">
                    <input type="checkbox" aria-label={`Marrësi ${r.channel} ${r.address} aktiv`} checked={r.enabled} onChange={async (e) => { await post({ action: "toggle", id: r.id, enabled: e.target.checked }); await load(); }} />
                    Aktiv
                  </label>
                  <button type="button" aria-label={`Hiq marrësin ${r.channel} ${r.address}`} className="min-h-11 px-3 text-sm text-red-700 underline" onClick={async () => { await post({ action: "remove", id: r.id }); await load(); }}>
                    Hiq
                  </button>
                </span>
              </div>
              {!r.verified && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const { ok } = await post({ action: "verify", id: r.id, code: codes[r.id] ?? "" });
                    if (ok) { setMsg("Marrësi u verifikua."); await load(); }
                  }}
                >
                  <label className="text-sm">
                    Kodi
                    <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} aria-label={`Kodi 6-shifror i verifikimit për ${r.address}`} className={inputClass} value={codes[r.id] ?? ""} onChange={(e) => setCodes((c) => ({ ...c, [r.id]: e.target.value }))} />
                  </label>
                  <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm text-white">Verifiko</button>
                  <button
                    type="button"
                    className="min-h-11 px-3 text-sm underline"
                    onClick={async () => {
                      const { ok, d } = await post({ action: "resend", id: r.id });
                      if (ok && d.devCode) setDevCodes((c) => ({ ...c, [r.id]: d.devCode }));
                    }}
                  >
                    Dërgo kod të ri
                  </button>
                  {devCodes[r.id] && <span className="text-xs text-muted">Kodi (vetëm në simulim): <code>{devCodes[r.id]}</code></span>}
                </form>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={add} className="space-y-3 border-t border-line pt-4">
          <h3 className="font-medium">Shto marrës</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Kanali
              <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as "Email" | "WhatsApp")}>
                <option value="Email">Email</option>
                <option value="WhatsApp">WhatsApp</option>
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              {channel === "Email" ? "Email" : "Numri WhatsApp (p.sh. +355 69…)"}
              <input className={inputClass} required value={address} onChange={(e) => setAddress(e.target.value)} type={channel === "Email" ? "email" : "tel"} />
            </label>
          </div>
          <label className="text-sm block">
            Etiketa (opsionale)
            <input className={inputClass} maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="p.sh. Recepsioni" />
          </label>
          {channel === "WhatsApp" && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" aria-label="Marrësi ka dhënë pëlqimin për njoftime rezervimesh në WhatsApp" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Marrësi ka dhënë pëlqimin për të marrë njoftime rezervimesh në WhatsApp.</span>
            </label>
          )}
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-5 text-white">Shto dhe dërgo kodin</button>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5" aria-labelledby="h-statusi">
        <h2 id="h-statusi" className="font-heading text-xl">Dërgimet e fundit</h2>
        {data.recent.length === 0 ? (
          <p className="text-muted text-sm mt-2">Ende s’ka njoftime.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-2 pr-3">Ngjarja</th>
                  <th className="py-2 pr-3">Kanali</th>
                  <th className="py-2 pr-3">Marrësi</th>
                  <th className="py-2 pr-3">Statusi</th>
                  <th className="py-2">Tentativa</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((j) => (
                  <tr key={j.id} className="border-t border-line">
                    <td className="py-2 pr-3">{TYPE_LABEL[j.type] ?? j.type}</td>
                    <td className="py-2 pr-3">{j.channel}</td>
                    <td className="py-2 pr-3">{j.recipient}</td>
                    <td className="py-2 pr-3">{STATUS_LABEL[j.status] ?? j.status}{j.lastError ? ` (${j.lastError.slice(0, 40)})` : ""}</td>
                    <td className="py-2">{j.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
