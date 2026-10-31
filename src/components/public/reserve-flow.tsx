"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Slot = { time: string; start: string; freeTables: number };
type Step = "when" | "time" | "contact" | "done";

function todayStr(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function ReserveFlow({
  slug,
  maxPartySize,
  timezone,
  initialDate,
  initialPartySize,
  initialTime,
}: {
  slug: string;
  maxPartySize: number;
  timezone: string;
  initialDate?: string;
  initialPartySize?: number;
  initialTime?: string;
}) {
  const idemKey = useMemo(
    () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    []
  );
  const minDate = todayStr(timezone);
  // Prefill nga kërkimi (nëse data e bartur s'është në të shkuarën); rikontrolli bëhet në server.
  const prefillDate = initialDate && initialDate >= minDate ? initialDate : null;
  const [step, setStep] = useState<Step>("when");
  const [date, setDate] = useState(prefillDate ?? minDate);
  const [partySize, setPartySize] = useState(
    initialPartySize && initialPartySize >= 1 && initialPartySize <= maxPartySize ? initialPartySize : 2
  );
  const [area, setArea] = useState<"no_preference" | "indoor" | "outdoor">("no_preference");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Slot | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [manageUrl, setManageUrl] = useState<string | null>(null);

  // Prefill nga kërkimi: ngarko oraret një herë dhe parazgjidh orën e kërkuar (nëse është e lirë).
  const didInit = useRef(false);
  const wantTime = useRef<string | null>(prefillDate && initialTime ? initialTime : null);

  async function loadSlots(goStep = true) {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/public/restaurants/${slug}/availability?date=${date}&partySize=${partySize}&area=${area}`);
      const d = await r.json();
      setSlots(Array.isArray(d.slots) ? d.slots : []);
      if (goStep) setStep("time");
    } catch {
      setError("Nuk u ngarkuan oraret. Provoni përsëri.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/restaurants/${slug}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: selected.start, partySize, requestedArea: area, firstName, lastName, phone, email, notes, idempotencyKey: idemKey }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        // Slot-i u zu ndërkohë → rifresko oraret dhe kthehu te zgjedhja.
        setError(d.error ?? "Rezervimi dështoi.");
        setSelected(null);
        await loadSlots(false);
        setStep("time");
        return;
      }
      setManageUrl(d.manageUrl);
      setStep("done");
    } catch {
      setError("Diçka shkoi keq. Provoni përsëri.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (prefillDate && !didInit.current) {
      didInit.current = true;
      void loadSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wantTime.current && slots.length > 0) {
      const match = slots.find((s) => s.time === wantTime.current);
      if (match) setSelected(match);
      wantTime.current = null;
    }
  }, [slots]);

  return (
    <div className="rprofile-body rsv">
      <div className="rsv-steps" aria-hidden="true">
        <span className={step === "when" ? "on" : ""}>1 · Data</span>
        <span className={step === "time" ? "on" : ""}>2 · Ora</span>
        <span className={step === "contact" ? "on" : ""}>3 · Kontakti</span>
      </div>

      {error && <div className="rprofile-notice" style={{ marginBottom: 14 }}>{error}</div>}

      {step === "when" && (
        <form className="rsv-card" onSubmit={(e) => { e.preventDefault(); loadSlots(); }}>
          <label className="rsv-field">
            <span>Data</span>
            <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="rsv-field">
            <span>Persona</span>
            <select value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}>
              {Array.from({ length: maxPartySize }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="rsv-field">
            <span>Zona</span>
            <select value={area} onChange={(e) => setArea(e.target.value as typeof area)}>
              <option value="no_preference">Pa preferencë</option>
              <option value="indoor">Brenda</option>
              <option value="outdoor">Jashtë</option>
            </select>
          </label>
          <button className="rsv-btn" type="submit" disabled={loading}>{loading ? "Duke kërkuar…" : "Shiko oraret"}</button>
        </form>
      )}

      {step === "time" && (
        <div className="rsv-card">
          <button type="button" className="rsv-back" onClick={() => setStep("when")}>← Ndrysho datën/personat</button>
          {slots.length === 0 ? (
            <p className="rsv-empty">Nuk ka orë të lira për këtë datë. Provoni një datë tjetër.</p>
          ) : (
            <>
              <div className="rsv-slots">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    className={`rsv-slot ${selected?.start === s.start ? "on" : ""}`}
                    onClick={() => setSelected(s)}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
              <button className="rsv-btn" type="button" disabled={!selected} onClick={() => setStep("contact")}>Vazhdo</button>
            </>
          )}
        </div>
      )}

      {step === "contact" && (
        <form className="rsv-card" onSubmit={submit}>
          <button type="button" className="rsv-back" onClick={() => setStep("time")}>← Ndrysho orën</button>
          <div className="rsv-summary">{date} · {selected?.time} · {partySize} persona</div>
          <label className="rsv-field"><span>Emri *</span><input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></label>
          <label className="rsv-field"><span>Mbiemri</span><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
          <label className="rsv-field"><span>Telefoni *</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required /></label>
          <label className="rsv-field"><span>Email (për konfirmim)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="rsv-field"><span>Shënim</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button className="rsv-btn" type="submit" disabled={submitting}>{submitting ? "Duke rezervuar…" : "Konfirmo rezervimin"}</button>
        </form>
      )}

      {step === "done" && (
        <div className="rsv-card rsv-done">
          <div className="rsv-check">✓</div>
          <h2>Rezervimi u konfirmua</h2>
          <p>{date} · {selected?.time} · {partySize} persona</p>
          {manageUrl && <a className="rsv-btn" href={manageUrl}>Shiko / menaxho rezervimin</a>}
        </div>
      )}
    </div>
  );
}
