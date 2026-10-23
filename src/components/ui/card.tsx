import type { ReactNode } from "react";

// Kartë e përbashkët: surface e bardhë, cepa të rrumbullakosura, konturë + hije e butë.
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card-sm sm:rounded-card border border-line bg-surface shadow-card ${className}`}>
      {children}
    </div>
  );
}

// Kartë statistike (KPI) — etiketë lart, vlerë e madhe poshtë.
export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}
