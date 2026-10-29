"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// URL bazë publike (prodhim: domain-i real te .env). QR gjithnjë me #000/#fff.
const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const QR_COLOR = { dark: "#000000", light: "#ffffff" };

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function QrGenerator({ code, slug }: { code: string; slug: string }) {
  // URL-ja e koduar është kod opak e i pandryshueshëm → `/q/[code]` ridrejton te PROFILI.
  // Ndryshimi i emrit/slug-ut NUK e prek; QR-i i printuar s'skadon kurrë.
  const url = `${BASE}/q/${code}`;

  const [preview, setPreview] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | "png" | "svg">(null);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 360,
      margin: 2,
      color: QR_COLOR,
      errorCorrectionLevel: "M",
    })
      .then(setPreview)
      .catch(() => setPreview(""));
  }, [url]);

  async function downloadPng() {
    setBusy("png");
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1000, // rezolucion i lartë për printim
        margin: 2,
        color: QR_COLOR,
        errorCorrectionLevel: "M",
      });
      triggerDownload(dataUrl, `qr-${slug}.png`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadSvg() {
    setBusy("svg");
    try {
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 2,
        color: QR_COLOR,
        errorCorrectionLevel: "M",
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const objUrl = URL.createObjectURL(blob);
      triggerDownload(objUrl, `qr-${slug}.svg`);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard e padisponueshme */
    }
  }

  return (
    <div className="max-w-md mx-auto lg:mx-0 space-y-6">
      <div>
        <h1 className="font-heading text-3xl">QR Kod</h1>
        <p className="text-muted text-sm mt-1">
          QR-i që hap profilin tuaj publik (menuja, informacioni dhe lidhjet hapen prej tij).
        </p>
      </div>

      {/* QR-i (sfond i bardhë — i domosdoshëm për skanim) */}
      <div className="rounded-2xl bg-white p-5 grid place-items-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={`QR për ${url}`}
            width={300}
            height={300}
            className="w-[300px] h-[300px] max-w-full"
          />
        ) : (
          <div className="w-[300px] h-[300px] grid place-items-center text-white/40 text-sm">
            Duke gjeneruar…
          </div>
        )}
      </div>

      {/* URL + kopjo */}
      <div>
        <span className="block text-xs text-muted mb-1">Adresa e koduar</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            className="min-w-0 flex-1 rounded-lg bg-surface border border-line px-3 py-2 text-sm text-muted outline-none"
          />
          <button
            onClick={copyLink}
            className="shrink-0 min-h-11 rounded-lg border border-line px-4 text-sm hover:border-primary transition"
          >
            {copied ? "✔ Kopjuar" : "Kopjo Link"}
          </button>
        </div>
      </div>

      {/* Shkarkimi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={downloadPng}
          disabled={!!busy}
          className="min-h-11 rounded-lg bg-primary px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy === "png" ? "Duke përgatitur…" : "Shkarko PNG"}
        </button>
        <button
          onClick={downloadSvg}
          disabled={!!busy}
          className="min-h-11 rounded-lg border border-primary/40 px-4 py-2 text-primary font-medium hover:bg-primary/10 disabled:opacity-50"
        >
          {busy === "svg" ? "Duke përgatitur…" : "Shkarko SVG"}
        </button>
      </div>

      {/* Udhëzime */}
      <p className="text-sm text-muted leading-relaxed rounded-lg border border-line bg-surface p-4">
        Printojeni këtë QR-kod dhe vendoseni në tavolinat tuaja. Klientët do ta
        skanojnë me kamerën e telefonit dhe do t&apos;u hapet profili i restorantit.
        <span className="block mt-2 text-xs text-muted">
          PNG për printim standard · SVG për madhësi të mëdha (banderolë, tabelë) pa
          humbje cilësie.
        </span>
      </p>
    </div>
  );
}
