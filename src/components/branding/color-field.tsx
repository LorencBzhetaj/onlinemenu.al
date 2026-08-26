"use client";

import { HexColorPicker } from "react-colorful";
import { isValidHex } from "@/lib/branding";

export function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const valid = isValidHex(value);

  return (
    <div>
      <span className="block text-sm text-alpine-cream/70 mb-1">{label}</span>
      {hint && <span className="block text-xs text-alpine-cream/40 mb-2">{hint}</span>}
      <div className="flex items-start gap-4">
        <HexColorPicker
          color={valid ? value : "#000000"}
          onChange={onChange}
          style={{ width: 130, height: 110 }}
        />
        <div className="space-y-2">
          <div
            className="h-10 w-10 rounded-lg border border-alpine-cream/20"
            style={{ background: valid ? value : "transparent" }}
          />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className={`w-28 rounded-lg bg-midnight border px-2 py-1.5 text-sm text-alpine-cream outline-none focus:border-alpine-gold ${
              valid ? "border-alpine-cream/20" : "border-red-400/60"
            }`}
          />
          {!valid && <span className="block text-xs text-red-400">Hex i pavlefshëm</span>}
        </div>
      </div>
    </div>
  );
}
