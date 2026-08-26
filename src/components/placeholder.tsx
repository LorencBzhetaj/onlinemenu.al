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
      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-heading text-3xl">{title}</h1>
        {phase && (
          <span className="text-xs rounded-full border border-alpine-gold/40 text-alpine-gold px-2 py-0.5">
            {phase}
          </span>
        )}
      </div>
      <div className="text-alpine-cream/70 max-w-2xl">
        {children ?? "Ky modul do të ndërtohet në një hap të ardhshëm."}
      </div>
    </div>
  );
}
