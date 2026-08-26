"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClass } from "@/components/menu/modal";
import { googleFontsHref, DEFAULT_HEADING, DEFAULT_BODY } from "@/lib/branding";

export type SettingsInitial = {
  name: string;
  slug: string;
  fontHeading: string | null;
  fontBody: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  estYear: number | null;
  taglineAl: string | null;
  taglineEn: string | null;
  subtitleAl: string | null;
  subtitleEn: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  isPublished: boolean;
};

const MAX = 80;
const SUPPORT_MAIL = "mailto:support@menudigjitale.al";

/** Ngarkon fontet e restorantit (+ script/ui) për mini-preview-n. */
function useFontPreview(fonts: string[]) {
  useEffect(() => {
    const id = "settings-preview-fonts";
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

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [estYear, setEstYear] = useState(initial.estYear ? String(initial.estYear) : "");
  const [taglineAl, setTaglineAl] = useState(initial.taglineAl ?? "");
  const [taglineEn, setTaglineEn] = useState(initial.taglineEn ?? "");
  const [subtitleAl, setSubtitleAl] = useState(initial.subtitleAl ?? "");
  const [subtitleEn, setSubtitleEn] = useState(initial.subtitleEn ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [isPublished, setIsPublished] = useState(initial.isPublished);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fontHeading = initial.fontHeading ?? DEFAULT_HEADING;
  const fontBody = initial.fontBody ?? DEFAULT_BODY;
  useFontPreview([fontHeading, fontBody, "Dancing Script", "Jost"]);

  // ── Validim ──
  const currentYear = new Date().getFullYear();
  const yearValid =
    estYear.trim() === "" ||
    (/^\d{4}$/.test(estYear.trim()) &&
      Number(estYear) >= 1800 &&
      Number(estYear) <= currentYear);
  const phoneValid = phone.trim() === "" || /^[0-9+\s-]+$/.test(phone.trim());
  const whatsappValid = whatsapp.trim() === "" || /^\d{8,15}$/.test(whatsapp.trim());
  const nameValid = name.trim().length > 0;
  const allValid = yearValid && phoneValid && whatsappValid && nameValid;

  async function save() {
    setError(null);
    if (!allValid) {
      setError("Ka fusha të pavlefshme — kontrolloni shënimet e kuqe.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/restaurant/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        estYear,
        taglineAl,
        taglineEn,
        subtitleAl,
        subtitleEn,
        phone,
        whatsapp,
        address,
        isPublished,
      }),
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
          <h1 className="font-heading text-3xl">Cilësime</h1>
          <p className="text-alpine-cream/60 text-sm mt-1">
            Profili i restorantit — ndarë nga Menu (përmbajtja) dhe Personalizim (ngjyra/fonte).
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-400">✔ U ruajt</span>}
          <button
            onClick={save}
            disabled={saving || !allValid}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* ── IDENTITETI ── */}
          <Section title="Identiteti">
            <Field label="Emri i shfaqur">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              {!nameValid && <span className="block text-xs text-red-400 mt-1">Emri s&apos;mund të jetë bosh.</span>}
            </Field>

            <div>
              <span className="block text-sm text-alpine-cream/70 mb-1">Slug (URL publike)</span>
              <input className={`${inputClass} opacity-60 cursor-not-allowed`} value={`/m/${initial.slug}`} readOnly disabled />
              <div className="mt-2 rounded-lg border border-alpine-gold/30 bg-midnight p-3 text-xs text-alpine-cream/70 leading-relaxed">
                Ky është pjesë e URL-së publike dhe QR-kodit tuaj. Ndryshimi i tij do të prishë
                QR-in e printuar tashmë.{" "}
                <a href={SUPPORT_MAIL} className="text-alpine-gold hover:underline">
                  Na kontaktoni
                </a>{" "}
                nëse doni ta ndryshoni.
              </div>
            </div>
          </Section>

          {/* ── HERO ── */}
          <Section title="Përmbajtja e Hero-s">
            <Field label="Viti i themelimit (EST.)" hint="Lihet bosh nëse s'doni ta shfaqni">
              <input
                className={inputClass}
                type="text"
                inputMode="numeric"
                placeholder="p.sh. 1922"
                value={estYear}
                onChange={(e) => setEstYear(e.target.value)}
              />
              {!yearValid && (
                <span className="block text-xs text-red-400 mt-1">
                  Duhet numër 4-shifror mes 1800 dhe {currentYear}.
                </span>
              )}
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CountedField label="Tagline (Shqip)" value={taglineAl} onChange={setTaglineAl} placeholder="Shije të Alpeve" />
              <CountedField label="Tagline (Anglisht)" value={taglineEn} onChange={setTaglineEn} placeholder="Flavours of the Alps" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CountedField label="Nëntitull (Shqip)" value={subtitleAl} onChange={setSubtitleAl} placeholder="Kuzhinë Tradicionale · Theth" />
              <CountedField label="Nëntitull (Anglisht)" value={subtitleEn} onChange={setSubtitleEn} placeholder="Traditional Cuisine · Theth" />
            </div>

            {/* Mini preview */}
            <HeroMiniPreview
              name={name}
              estYear={estYear}
              tagline={taglineAl}
              subtitle={subtitleAl}
              primary={initial.primaryColor ?? "#0f1720"}
              accent={initial.accentColor ?? "#c9a24b"}
              fontHeading={fontHeading}
            />
          </Section>

          {/* ── KONTAKTI ── */}
          <Section title="Kontakti">
            <Field label="Telefon">
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+355 67 204 6333" />
              {!phoneValid && <span className="block text-xs text-red-400 mt-1">Lejohen vetëm numra, hapësira, &apos;+&apos; dhe &apos;-&apos;.</span>}
            </Field>

            <Field label="WhatsApp">
              <input className={inputClass} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="355672046333" />
              <span className={`block text-xs mt-1 ${whatsappValid ? "text-alpine-cream/50" : "text-red-400"}`}>
                Numër ndërkombëtar i plotë pa &apos;+&apos;, vetëm shifra (p.sh. 355672046333) — përndryshe
                butoni &quot;Rezervo Tavolinë&quot; s&apos;do funksionojë saktë.
              </span>
            </Field>

            <Field label="Adresa" hint="opsionale">
              <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Theth, Shkodër" />
            </Field>
          </Section>
        </div>

        {/* ── PUBLIKIMI (kolona e dytë) ── */}
        <div className="lg:sticky lg:top-8 self-start">
          <Section title="Statusi i Publikimit">
            <button
              type="button"
              onClick={() => setIsPublished((v) => !v)}
              className={`w-full flex items-center justify-between rounded-xl border px-5 py-4 transition ${
                isPublished ? "border-green-400/50 bg-green-400/10" : "border-red-400/40 bg-red-400/5"
              }`}
            >
              <span className="text-left">
                <span className="block font-heading text-xl">
                  {isPublished ? "Menu Aktive" : "Menu Jo Aktive"}
                </span>
                <span className="block text-xs text-alpine-cream/50 mt-0.5">
                  Kliko për të {isPublished ? "fikur" : "ndezur"}
                </span>
              </span>
              <span
                className={`relative h-7 w-12 rounded-full transition ${isPublished ? "bg-green-400" : "bg-alpine-cream/25"}`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${isPublished ? "left-[22px]" : "left-0.5"}`}
                />
              </span>
            </button>

            {!isPublished && (
              <div className="rounded-lg border border-red-400/30 bg-midnight p-3 text-xs text-alpine-cream/70 leading-relaxed">
                Kur është fikur, faqja juaj publike (<span className="text-alpine-cream">/m/{initial.slug}</span>)
                do t&apos;u shfaqë vizitorëve mesazhin &quot;Menu përkohësisht jo aktive&quot; në vend të menusë.
                Përdoreni nëse jeni mbyllur përkohësisht ose po bëni ndryshime të mëdha.
              </div>
            )}

            <p className="text-xs text-alpine-cream/40 leading-relaxed">
              Ky është i ndarë nga statusi i <span className="text-alpine-cream/60">abonimit</span> (shih te{" "}
              <span className="text-alpine-cream/60">Abonimi</span>). Faqja publike shfaqet vetëm kur
              menuja është aktive DHE abonimi është aktiv.
            </p>
          </Section>
        </div>
      </div>
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

function CountedField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-alpine-cream/70 mb-1">{label}</span>
      <input
        className={inputClass}
        value={value}
        maxLength={MAX}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="block text-[11px] text-alpine-cream/35 mt-1 text-right">
        {value.length}/{MAX}
      </span>
    </label>
  );
}

function HeroMiniPreview({
  name,
  estYear,
  tagline,
  subtitle,
  primary,
  accent,
  fontHeading,
}: {
  name: string;
  estYear: string;
  tagline: string;
  subtitle: string;
  primary: string;
  accent: string;
  fontHeading: string;
}) {
  return (
    <div>
      <span className="block text-xs text-alpine-cream/40 mb-1.5">Parapamje (Shqip)</span>
      <div className="rounded-xl px-5 py-7 text-center" style={{ background: primary }}>
        {estYear.trim() && /^\d{4}$/.test(estYear.trim()) && (
          <div style={{ color: accent, letterSpacing: 3, fontSize: 10, fontFamily: '"Jost", sans-serif' }} className="uppercase mb-1.5">
            EST. {estYear}
          </div>
        )}
        <div style={{ fontFamily: `"${fontHeading}", serif`, color: "#fff", letterSpacing: 4 }} className="text-2xl">
          {name || "Emri i Restorantit"}
        </div>
        {tagline.trim() && (
          <div style={{ fontFamily: '"Dancing Script", cursive', color: accent }} className="text-2xl mt-1">
            {tagline}
          </div>
        )}
        {subtitle.trim() && (
          <div style={{ fontFamily: '"Jost", sans-serif', color: "rgba(255,255,255,0.6)", letterSpacing: 2, fontSize: 10 }} className="uppercase mt-2">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
