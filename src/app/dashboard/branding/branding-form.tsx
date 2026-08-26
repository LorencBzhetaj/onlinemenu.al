"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ColorField } from "@/components/branding/color-field";
import { FontSelect } from "@/components/branding/font-select";
import { LivePreview } from "@/components/branding/live-preview";
import { ImageUpload } from "@/components/menu/image-upload";
import {
  HEADING_FONTS,
  BODY_FONTS,
  THEME_PRESETS,
  MENU_PHOTO_STYLES,
  DEFAULT_HEADING,
  DEFAULT_BODY,
  isValidHex,
  googleFontsHref,
  getInitials,
  type MenuPhotoStyle,
} from "@/lib/branding";

export type BrandingInitial = {
  name: string;
  primaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  logoUrl: string | null;
  menuPhotoStyle: string;
};

/** Injekton (dinamikisht) fontet e zgjedhura në <head> për preview-n live. */
function useFontPreview(fonts: string[]) {
  useEffect(() => {
    const id = "branding-preview-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = googleFontsHref(fonts);
  }, [fonts]);
}

export function BrandingForm({ initial }: { initial: BrandingInitial }) {
  const router = useRouter();
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor ?? "#0f1720");
  const [accentColor, setAccentColor] = useState(initial.accentColor ?? "#c9a24b");
  const [fontHeading, setFontHeading] = useState(initial.fontHeading ?? DEFAULT_HEADING);
  const [fontBody, setFontBody] = useState(initial.fontBody ?? DEFAULT_BODY);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [menuPhotoStyle, setMenuPhotoStyle] = useState<MenuPhotoStyle>(
    (initial.menuPhotoStyle as MenuPhotoStyle) ?? "none"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFontPreview([fontHeading, fontBody]);

  const colorsValid = isValidHex(primaryColor) && isValidHex(accentColor);

  function applyPreset(primary: string, accent: string) {
    setPrimaryColor(primary);
    setAccentColor(accent);
  }

  async function save() {
    setError(null);
    if (!colorsValid) {
      setError("Ngjyrat duhet të jenë hex valid (p.sh. #1a2b3c).");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/restaurant/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryColor, accentColor, fontHeading, fontBody, logoUrl, menuPhotoStyle }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Ruajtja dështoi.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl">Personalizim</h1>
          <p className="text-alpine-cream/60 text-sm mt-1">
            Identiteti vizual i menusë sate publike. Ndryshimet shfaqen te parapamja live.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-400">✔ U ruajt</span>}
          <button
            onClick={save}
            disabled={saving || !colorsValid}
            className="rounded-lg bg-alpine-gold px-5 py-2 text-midnight font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Duke ruajtur…" : "Ruaj"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Kolona e formularit ── */}
        <div className="space-y-8">
          {/* NGJYRA */}
          <Section title="Ngjyra">
            <div>
              <span className="block text-sm text-alpine-cream/70 mb-2">Tema të gatshme</span>
              <div className="grid grid-cols-3 gap-2">
                {THEME_PRESETS.map((t) => {
                  const active = primaryColor === t.primary && accentColor === t.accent;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => applyPreset(t.primary, t.accent)}
                      className={`rounded-lg border p-2 text-left transition ${
                        active ? "border-alpine-gold" : "border-alpine-cream/15 hover:border-alpine-cream/40"
                      }`}
                    >
                      <div className="flex gap-1 mb-1.5">
                        <span className="h-5 w-5 rounded" style={{ background: t.primary }} />
                        <span className="h-5 w-5 rounded" style={{ background: t.accent }} />
                      </div>
                      <span className="text-[11px] text-alpine-cream/60 leading-tight block">
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 pt-2">
              <ColorField
                label="Ngjyra kryesore"
                hint="Sfondi, header, badge çmimi"
                value={primaryColor}
                onChange={setPrimaryColor}
              />
              <ColorField
                label="Ngjyra e theksit"
                hint="Aksente, dividers, hover"
                value={accentColor}
                onChange={setAccentColor}
              />
            </div>
          </Section>

          {/* TIPOGRAFIA */}
          <Section title="Tipografia">
            <FontSelect label="Font i Titujve" options={HEADING_FONTS} value={fontHeading} onChange={setFontHeading} />
            <FontSelect label="Font i Tekstit" options={BODY_FONTS} value={fontBody} onChange={setFontBody} />
          </Section>

          {/* LOGO */}
          <Section title="Logo">
            <ImageUpload value={logoUrl} onChange={setLogoUrl} />
            <div>
              <span className="block text-sm text-alpine-cream/70 mb-2">Parapamje në kontekst</span>
              <div className="flex items-center gap-6">
                <LogoPreview logoUrl={logoUrl} name={initial.name} size={34} accent={accentColor} label="Header (34px)" />
                <LogoPreview logoUrl={logoUrl} name={initial.name} size={78} accent={accentColor} label="Hero (78px)" />
              </div>
            </div>
          </Section>

          {/* FOTO NË MENU */}
          <Section title="Foto në menu">
            <p className="text-sm text-alpine-cream/60 -mt-2">
              Si të shfaqen fotot e artikujve te menuja publike. Artikujt pa foto mbeten
              gjithnjë tekst i pastër.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MENU_PHOTO_STYLES.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMenuPhotoStyle(opt.key)}
                  className={`rounded-lg border p-3 text-left transition ${
                    menuPhotoStyle === opt.key
                      ? "border-alpine-gold bg-alpine-gold/10"
                      : "border-alpine-cream/15 hover:border-alpine-cream/40"
                  }`}
                >
                  <PhotoStyleThumb kind={opt.key} />
                  <span className="block text-sm text-alpine-cream mt-2">{opt.label}</span>
                  <span className="block text-xs text-alpine-cream/40">{opt.hint}</span>
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Kolona e parapamjes (sticky në desktop) ── */}
        <div className="lg:sticky lg:top-8 self-start w-full">
          <LivePreview
            name={initial.name}
            primaryColor={primaryColor}
            accentColor={accentColor}
            fontHeading={fontHeading}
            fontBody={fontBody}
            logoUrl={logoUrl}
          />
        </div>
      </div>
    </div>
  );
}

/** Ilustrim i vogël i layout-it të kartës për secilin stil foto. */
function PhotoStyleThumb({ kind }: { kind: MenuPhotoStyle }) {
  const bar = "h-1.5 rounded-full bg-alpine-cream/25";
  const img = "rounded bg-alpine-gold/40";
  return (
    <div className="rounded-md border border-alpine-cream/10 bg-midnight p-2 h-20 flex flex-col justify-center gap-1.5">
      {kind === "large" && (
        <>
          <div className={`${img} h-8 w-full`} />
          <div className={`${bar} w-3/4`} />
          <div className={`${bar} w-1/2`} />
        </>
      )}
      {kind === "thumbnail" && (
        <div className="flex items-center gap-2">
          <div className={`${img} h-9 w-9 shrink-0`} />
          <div className="flex-1 space-y-1.5">
            <div className={`${bar} w-3/4`} />
            <div className={`${bar} w-1/2`} />
          </div>
        </div>
      )}
      {kind === "none" && (
        <>
          <div className={`${bar} w-3/4`} />
          <div className={`${bar} w-full`} />
          <div className={`${bar} w-1/2`} />
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-alpine-cream/12 bg-midnight-soft p-5 space-y-5">
      <h2 className="font-heading text-xl text-alpine-gold">{title}</h2>
      {children}
    </div>
  );
}

function LogoPreview({
  logoUrl,
  name,
  size,
  accent,
  label,
}: {
  logoUrl: string | null;
  name: string;
  size: number;
  accent: string;
  label: string;
}) {
  return (
    <div className="text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="rounded-full object-cover mx-auto"
          style={{ width: size, height: size, border: `2px solid ${accent}` }}
        />
      ) : (
        <div
          className="grid place-items-center rounded-full mx-auto"
          style={{ width: size, height: size, border: `2px solid ${accent}`, color: accent, fontSize: size / 3 }}
        >
          {getInitials(name)}
        </div>
      )}
      <span className="block text-[11px] text-alpine-cream/40 mt-1.5">{label}</span>
    </div>
  );
}
