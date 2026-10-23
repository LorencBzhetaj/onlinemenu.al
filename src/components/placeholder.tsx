import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function Placeholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-2xl sm:text-3xl text-ink">{title}</h1>
        {phase && <Badge tone="info">{phase}</Badge>}
      </div>
      <Card className="max-w-2xl p-6 text-muted">
        {children ?? "Ky modul do të ndërtohet në një hap të ardhshëm."}
      </Card>
    </div>
  );
}
