"use client";

import type { HandleProps } from "./sortable";
import type { ItemDTO } from "@/lib/menu-types";

function formatPrice(price: number): string {
  return `${price.toLocaleString("sq-AL")} L`;
}

export function ItemRow({
  item,
  handleProps,
  onEdit,
  onDelete,
  onToggleVisible,
}: {
  item: ItemDTO;
  handleProps: HandleProps;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisible: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2 mb-2 ${
        item.isVisible ? "" : "opacity-50"
      }`}
    >
      <span {...handleProps} className="touch-none px-1 cursor-grab active:cursor-grabbing text-muted hover:text-muted text-lg">
        ⠿
      </span>

      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded bg-black/5 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-ink truncate">{item.nameAl}</span>
          {item.isChefPick && (
            <span className="text-[10px] rounded-full border border-primary/40 text-primary px-1.5 py-0.5">
              Shefi
            </span>
          )}
          {item.isDailyMenu && (
            <span className="text-[10px] rounded-full border border-line text-muted px-1.5 py-0.5">
              Ditore
            </span>
          )}
        </div>
        {item.descAl && (
          <p className="text-xs text-muted truncate">{item.descAl}</p>
        )}
      </div>

      <span className="text-primary whitespace-nowrap text-sm">
        {formatPrice(item.price)}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <IconButton title={item.isVisible ? "Fshih" : "Shfaq"} onClick={onToggleVisible}>
          {item.isVisible ? "👁" : "🚫"}
        </IconButton>
        <IconButton title="Ndrysho" onClick={onEdit}>
          ✎
        </IconButton>
        <IconButton title="Fshi" onClick={onDelete} danger>
          🗑
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-md px-2 py-1 text-sm hover:bg-black/5 transition ${
        danger ? "text-red-600" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}
