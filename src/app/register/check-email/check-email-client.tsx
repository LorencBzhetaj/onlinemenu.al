"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function CheckEmailClient() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    if (!email) return;
    setStatus("sending");
    setMessage(null);
    const res = await fetch("/api/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Ridërgimi dështoi. Provoni sërish më vonë.");
      return;
    }
    setStatus("sent");
    setMessage("E ridërguam. Kontrolloni email-in (edhe spam-in).");
  }

  return (
    <main className="min-h-screen grid place-items-center bg-canvas text-ink px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-2xl">
          ✉️
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl mb-3">Verifiko email-in</h1>
        <p className="text-sm leading-relaxed text-muted mb-6">
          Dërguam një link dhe një kod 6-shifror
          {email ? (
            <>
              {" "}te <span className="text-primary break-all">{email}</span>
            </>
          ) : null}
          . Kliko butonin te email-i, ose fut kodin në faqen e verifikimit. Linku dhe kodi
          skadojnë pas 1 ore.
        </p>

        <Link
          href={email ? `/verify-email?email=${encodeURIComponent(email)}` : "/verify-email"}
          className="block w-full min-h-11 rounded-lg bg-primary py-3 text-white font-medium hover:opacity-90 transition"
        >
          Kam një kod — vazhdo
        </Link>

        <button
          onClick={resend}
          disabled={status === "sending" || !email}
          className="mt-3 w-full min-h-11 rounded-lg border border-line py-3 text-sm text-muted hover:border-primary transition disabled:opacity-50"
        >
          {status === "sending" ? "Duke ridërguar..." : "Ridërgo email-in"}
        </button>

        {message && (
          <p
            className={`mt-4 text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}
          >
            {message}
          </p>
        )}

        <p className="mt-8 text-sm text-muted">
          <Link href="/login" className="text-primary hover:underline">
            Kthehu te hyrja
          </Link>
        </p>
      </div>
    </main>
  );
}
