"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { inputClass } from "./modal";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const cloudinaryConfigured = Boolean(CLOUD && PRESET);

// Kompresim/resize në klient para upload-it (foto telefoni janë 5-10MB).
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    return await imageCompression(file, {
      maxWidthOrHeight: 1200,
      maxSizeMB: 1,
      useWebWorker: true,
    });
  } catch {
    return file; // nëse dështon, ngarko origjinalin
  }
}

export function ImageUpload({
  value,
  onChange,
  photoCapture = "environment",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Kamera për "Bëj Foto": "environment" (e pasme, foto pjatash) ose "user" (e përparme). */
  photoCapture?: "environment" | "user";
}) {
  const [busy, setBusy] = useState<null | "compress" | "upload">(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lejo rizgjedhjen e të njëjtit skedar
    if (!file) return;
    setError(null);

    try {
      setBusy("compress");
      const compressed = await compress(file);

      setBusy("upload");
      const form = new FormData();
      form.append("file", compressed);
      form.append("upload_preset", PRESET as string);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.secure_url) throw new Error(data?.error?.message ?? "Upload dështoi.");
      onChange(data.secure_url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload dështoi.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Parapamje" className="h-32 w-full object-cover rounded-lg border border-alpine-cream/15" />
      )}

      {cloudinaryConfigured ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={!!busy}
              className="min-h-11 rounded-lg border border-alpine-cream/20 px-3 py-2 text-sm text-alpine-cream/80 hover:border-alpine-gold disabled:opacity-50"
            >
              📷 Bëj Foto
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={!!busy}
              className="min-h-11 rounded-lg border border-alpine-cream/20 px-3 py-2 text-sm text-alpine-cream/80 hover:border-alpine-gold disabled:opacity-50"
            >
              🖼 Zgjidh nga Pajisja
            </button>
          </div>
          {/* Kamera (hap direkt kamerën në telefon) */}
          <input ref={cameraRef} type="file" accept="image/*" capture={photoCapture} onChange={handleFile} className="hidden" />
          {/* Galeria / file system */}
          <input ref={galleryRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          {busy && (
            <p className="text-xs text-alpine-gold">
              {busy === "compress" ? "Duke kompresuar…" : "Duke ngarkuar…"}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-alpine-cream/40">
          Cloudinary s&apos;është konfiguruar — përdor URL manuale më poshtë.
        </p>
      )}

      <div>
        <span className="block text-xs text-alpine-cream/40 mb-1">ose vendos një URL:</span>
        <input
          type="url"
          placeholder="https://…"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inputClass}
        />
      </div>

      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-xs text-red-400 hover:underline">
          Hiq imazhin
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
