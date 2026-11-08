"use client";

// Butonat e hyrjes me ofrues të jashtëm — shfaqen VETËM për ofruesit e konfiguruar realisht
// (lista vjen nga /api/auth/providers). Apple mbetet i fshehur derisa të ketë kredenciale.
import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { GoogleButton } from "./google-button";

function AppleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.32 1.16-.05 1.59-.75 2.99-.75s1.79.75 3.01.72c1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.53 1.26-2.6-.03-.01-2.42-.93-2.45-3.72ZM14.1 5.84c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.03.08 2.07-.52 2.71-1.28Z" />
    </svg>
  );
}

export function OAuthButtons({ callbackUrl, verb = "Vazhdo" }: { callbackUrl: string; verb?: string }) {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    getProviders()
      .then((p) => setIds(p ? Object.keys(p) : []))
      .catch(() => setIds([]));
  }, []);
  if (!ids) return <div className="h-11" aria-hidden="true" />;
  return (
    <div className="space-y-2">
      {ids.includes("google") && <GoogleButton label={`${verb} me Google`} callbackUrl={callbackUrl} />}
      {ids.includes("apple") && (
        <button
          type="button"
          onClick={() => signIn("apple", { callbackUrl })}
          className="w-full min-h-11 flex items-center justify-center gap-3 rounded-lg bg-black text-white font-medium hover:bg-black/85 transition py-3"
        >
          <AppleLogo />
          {verb} me Apple
        </button>
      )}
    </div>
  );
}

/** A ka të paktën një ofrues OAuth (për të vendosur ndarësin "ose"). */
export function useHasOAuth(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    getProviders()
      .then((p) => setHas(!!p && Object.keys(p).some((k) => k === "google" || k === "apple")))
      .catch(() => setHas(false));
  }, []);
  return has;
}
