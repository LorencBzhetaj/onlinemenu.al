import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-black/5 text-muted",
  // Statuset mbeten të dallueshme nga marka: jeshile = sukses, portokalli = paralajmërim, e kuqe = gabim.
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
  info: "bg-primary-soft text-ink", // Butter + Aubergine (p.sh. provë falas)
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

// Harton statuset e njohura të abonimit → ngjyrë.
const SUB_TONE: Record<string, Tone> = {
  active: "success",
  trial: "info",
  expired: "danger",
  cancelled: "neutral",
};
const SUB_LABEL: Record<string, string> = { active: "aktiv", trial: "provë falas", expired: "skaduar", cancelled: "anuluar" };
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={SUB_TONE[status] ?? "neutral"}>{SUB_LABEL[status] ?? status}</Badge>;
}
