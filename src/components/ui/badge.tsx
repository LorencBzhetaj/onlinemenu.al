import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-black/5 text-muted",
  success: "bg-primary-soft text-primary",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
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
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={SUB_TONE[status] ?? "neutral"}>{status}</Badge>;
}
