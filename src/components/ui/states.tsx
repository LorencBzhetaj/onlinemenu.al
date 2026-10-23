import type { ReactNode } from "react";
import { Card } from "./card";

// Gjendje bosh e njësuar (empty state) për lista/tabela.
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card-sm border border-dashed border-line bg-surface/60 p-10 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>}
    </div>
  );
}

// Njoftim i njësuar (p.sh. pa restorant / pa leje).
export function Notice({ children }: { children: ReactNode }) {
  return <Card className="p-6 text-muted">{children}</Card>;
}
