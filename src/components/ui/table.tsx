import type { ReactNode } from "react";
import { Card } from "./card";
import { EmptyState } from "./states";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Fshihet në pamjen mobile (kartë) nëse true. */
  hideOnMobile?: boolean;
};

// Tabelë responsive: <table> në desktop, karta të stivosura në telefon (pa scroll horizontal).
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "Asnjë rezultat.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <>
      {/* Desktop */}
      <Card className="hidden overflow-hidden sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-medium">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line/70 last:border-0 hover:bg-black/[0.015]">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-ink">
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile: karta */}
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <Card key={rowKey(row)} className="p-4">
            <dl className="space-y-1.5">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-3">
                    <dt className="text-xs uppercase tracking-wide text-muted">{c.header}</dt>
                    <dd className="text-right text-sm text-ink">{c.render(row)}</dd>
                  </div>
                ))}
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
