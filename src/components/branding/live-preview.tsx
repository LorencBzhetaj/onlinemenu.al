"use client";

import { getInitials } from "@/lib/branding";

export function LivePreview({
  name,
  primaryColor,
  accentColor,
  fontHeading,
  fontBody,
  logoUrl,
}: {
  name: string;
  primaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  logoUrl: string | null;
}) {
  return (
    <div className="rounded-xl border border-alpine-cream/15 overflow-hidden">
      <div className="bg-midnight-soft px-4 py-2 text-xs text-alpine-cream/50 border-b border-alpine-cream/10">
        Parapamje live — dukja e Hero-s publike
      </div>
      <div
        className="px-6 py-12 text-center"
        style={{ background: primaryColor, fontFamily: `"${fontBody}", serif` }}
      >
        {/* Logo ose fallback me iniciale */}
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="mx-auto mb-5 h-[78px] w-[78px] rounded-full object-cover"
            style={{ border: `2px solid ${accentColor}` }}
          />
        ) : (
          <div
            className="mx-auto mb-5 grid h-[78px] w-[78px] place-items-center rounded-full text-2xl"
            style={{ border: `2px solid ${accentColor}`, color: accentColor }}
          >
            {getInitials(name)}
          </div>
        )}

        <h1
          className="text-4xl"
          style={{ fontFamily: `"${fontHeading}", serif`, color: accentColor }}
        >
          {name}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#f5f0e6", opacity: 0.75 }}>
          Kuzhinë tradicionale me shije alpine
        </p>

        <button
          className="mt-6 rounded-full px-6 py-2.5 text-sm font-medium tracking-wide"
          style={{ background: accentColor, color: primaryColor }}
        >
          MENU KRYESORE
        </button>
      </div>
    </div>
  );
}
