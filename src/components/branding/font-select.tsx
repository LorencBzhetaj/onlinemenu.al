"use client";

import type { FontOption } from "@/lib/branding";
import { inputClass } from "@/components/menu/modal";

export function FontSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FontOption[];
  value: string;
  onChange: (family: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-alpine-cream/70 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.family} value={o.family}>
            {o.label}
          </option>
        ))}
      </select>
      {/* Preview inline: emri i fontit i shkruar me vetë fontin. */}
      <span
        className="block mt-2 text-2xl text-alpine-cream/90"
        style={{ fontFamily: `"${value}", serif` }}
      >
        {value}
      </span>
    </label>
  );
}
