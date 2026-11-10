"use client";

// Anulimi nga klienti me dialog të qartë (jo confirm() i shfletuesit).
// <dialog>.showModal(): fokusi mbetet brenda, Esc e mbyll, fokusi kthehet te butoni që e hapi.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DANGER = "#b4461f";

export function CancelBooking({ token, summary }: { token: string; summary?: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onClose = () => openerRef.current?.focus();
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
    keepRef.current?.focus(); // fokusi fillestar te veprimi i sigurt
  }

  async function confirmCancel() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/public/bookings/${token}/cancel`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setError(d.error ?? "Anulimi dështoi.");
        return;
      }
      dialogRef.current?.close();
      router.refresh();
    } catch {
      setError("Diçka shkoi keq. Provoni përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={open}
        className="rsv-btn"
        style={{ background: "transparent", color: DANGER, borderColor: "rgba(180,70,31,0.4)" }}
      >
        Anulo rezervimin
      </button>

      <dialog ref={dialogRef} className="om-dialog" aria-labelledby="cancel-title" aria-describedby="cancel-desc">
        <h2 id="cancel-title" className="om-dialog-title">Ta anulojmë rezervimin?</h2>
        <p id="cancel-desc" className="om-dialog-text">
          {summary ? <><strong>{summary}</strong><br /></> : null}
          Restoranti njoftohet menjëherë. Anulimi nuk mund të kthehet mbrapsht.
        </p>
        {error && <p className="om-dialog-error" role="alert">{error}</p>}
        <div className="om-dialog-actions">
          <button ref={keepRef} type="button" className="rsv-btn om-dialog-keep" onClick={() => dialogRef.current?.close()} disabled={busy}>
            Jo, mbaje
          </button>
          <button type="button" className="rsv-btn om-dialog-danger" onClick={confirmCancel} disabled={busy} aria-busy={busy}>
            {busy ? "Duke anuluar…" : "Po, anuloje"}
          </button>
        </div>
      </dialog>
    </>
  );
}
