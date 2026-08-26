"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SortableList, SortableItem } from "@/components/menu/sortable";
import { ItemRow } from "@/components/menu/item-row";
import { CategoryModal } from "@/components/menu/category-modal";
import { SubcategoryModal } from "@/components/menu/subcategory-modal";
import { ItemModal } from "@/components/menu/item-modal";
import { CategoryIcon } from "@/lib/menu-icons";
import type { CategoryDTO, SubcategoryDTO, ItemDTO } from "@/lib/menu-types";

type Modal =
  | { kind: "category-new" }
  | { kind: "category-edit"; category: CategoryDTO }
  | { kind: "subcategory-new"; categoryId: string }
  | { kind: "subcategory-edit"; categoryId: string; subcategory: SubcategoryDTO }
  | { kind: "item-new"; parent: { categoryId?: string; subcategoryId?: string } }
  | { kind: "item-edit"; item: ItemDTO }
  | null;

async function postReorder(type: "category" | "subcategory" | "item", ids: string[]) {
  await fetch("/api/menu/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ids }),
  });
}

export function MenuManager({ initialTree }: { initialTree: CategoryDTO[] }) {
  const router = useRouter();
  const [tree, setTree] = useState<CategoryDTO[]>(initialTree);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialTree.map((c) => c.id))
  );
  const [modal, setModal] = useState<Modal>(null);

  // Ri-sinkronizim kur serveri kthen të dhëna të reja (pas refresh).
  useEffect(() => setTree(initialTree), [initialTree]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function closeAndRefresh() {
    setModal(null);
    router.refresh();
  }

  // ---- Ri-renditje (optimiste) ----
  function reorderCategories(newIds: string[]) {
    setTree((prev) => newIds.map((id) => prev.find((c) => c.id === id)!).filter(Boolean));
    postReorder("category", newIds);
  }

  function reorderSubcategories(categoryId: string, newIds: string[]) {
    setTree((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? { ...c, subcategories: newIds.map((id) => c.subcategories.find((s) => s.id === id)!) }
          : c
      )
    );
    postReorder("subcategory", newIds);
  }

  function reorderCategoryItems(categoryId: string, newIds: string[]) {
    setTree((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? { ...c, items: newIds.map((id) => c.items.find((i) => i.id === id)!) }
          : c
      )
    );
    postReorder("item", newIds);
  }

  function reorderSubcategoryItems(categoryId: string, subId: string, newIds: string[]) {
    setTree((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              subcategories: c.subcategories.map((s) =>
                s.id === subId
                  ? { ...s, items: newIds.map((id) => s.items.find((i) => i.id === id)!) }
                  : s
              ),
            }
          : c
      )
    );
    postReorder("item", newIds);
  }

  // ---- Veprime ----
  async function toggleVisible(item: ItemDTO) {
    await fetch(`/api/menu-items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !item.isVisible }),
    });
    router.refresh();
  }

  async function del(url: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    await fetch(url, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl">Menu</h1>
          <p className="text-alpine-cream/60 text-sm mt-1">
            Menaxho kategoritë, nën-kategoritë dhe artikujt. Zvarrit ⠿ për të rirenditur.
          </p>
        </div>
        <button
          onClick={() => setModal({ kind: "category-new" })}
          className="rounded-lg bg-alpine-gold px-4 py-2 text-midnight font-medium hover:opacity-90"
        >
          + Kategori e Re
        </button>
      </div>

      {tree.length === 0 && (
        <div className="rounded-lg border border-dashed border-alpine-cream/20 p-10 text-center text-alpine-cream/50">
          Ende s&apos;ka kategori. Fillo duke shtuar një kategori.
        </div>
      )}

      <SortableList ids={tree.map((c) => c.id)} onReorder={reorderCategories}>
        {tree.map((cat) => (
          <SortableItem key={cat.id} id={cat.id}>
            {(handle) => (
              <div className="mb-3 rounded-xl border border-alpine-cream/12 bg-midnight-soft">
                {/* Kreu i kategorisë */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span {...handle} className="touch-none px-1 cursor-grab active:cursor-grabbing text-alpine-cream/30 hover:text-alpine-cream/70 text-lg">
                    ⠿
                  </span>
                  <button onClick={() => toggleExpand(cat.id)} className="text-alpine-cream/50 w-4">
                    {expanded.has(cat.id) ? "▾" : "▸"}
                  </button>
                  <CategoryIcon icon={cat.icon} className="w-5 h-5 text-alpine-gold" />
                  <div className="flex-1 min-w-0">
                    <div className="text-alpine-cream truncate">{cat.nameAl}</div>
                    <div className="text-xs text-alpine-cream/40 truncate">{cat.nameEn}</div>
                  </div>
                  <HeaderBtn onClick={() => setModal({ kind: "subcategory-new", categoryId: cat.id })}>
                    + Nën-kategori
                  </HeaderBtn>
                  <HeaderBtn onClick={() => setModal({ kind: "item-new", parent: { categoryId: cat.id } })}>
                    + Artikull
                  </HeaderBtn>
                  <HeaderBtn onClick={() => setModal({ kind: "category-edit", category: cat })}>
                    ✎
                  </HeaderBtn>
                  <HeaderBtn
                    danger
                    onClick={() =>
                      del(`/api/categories/${cat.id}`, `Fshi kategorinë "${cat.nameAl}" dhe gjithçka brenda saj?`)
                    }
                  >
                    🗑
                  </HeaderBtn>
                </div>

                {expanded.has(cat.id) && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Artikujt direkt nën kategori */}
                    {cat.items.length > 0 && (
                      <SortableList
                        ids={cat.items.map((i) => i.id)}
                        onReorder={(ids) => reorderCategoryItems(cat.id, ids)}
                      >
                        {cat.items.map((item) => (
                          <SortableItem key={item.id} id={item.id}>
                            {(h) => (
                              <ItemRow
                                item={item}
                                handleProps={h}
                                onEdit={() => setModal({ kind: "item-edit", item })}
                                onToggleVisible={() => toggleVisible(item)}
                                onDelete={() => del(`/api/menu-items/${item.id}`, `Fshi "${item.nameAl}"?`)}
                              />
                            )}
                          </SortableItem>
                        ))}
                      </SortableList>
                    )}

                    {/* Nën-kategoritë */}
                    <SortableList
                      ids={cat.subcategories.map((s) => s.id)}
                      onReorder={(ids) => reorderSubcategories(cat.id, ids)}
                    >
                      {cat.subcategories.map((sub) => (
                        <SortableItem key={sub.id} id={sub.id}>
                          {(h) => (
                            <div className="rounded-lg border border-alpine-cream/10 bg-midnight/50 p-3 mb-2">
                              <div className="flex items-center gap-3 mb-2">
                                <span {...h} className="touch-none px-1 cursor-grab active:cursor-grabbing text-alpine-cream/30 hover:text-alpine-cream/70">
                                  ⠿
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-alpine-cream/90 text-sm">{sub.nameAl}</span>
                                  <span className="text-xs text-alpine-cream/40 ml-2">{sub.nameEn}</span>
                                </div>
                                <HeaderBtn onClick={() => setModal({ kind: "item-new", parent: { subcategoryId: sub.id } })}>
                                  + Artikull
                                </HeaderBtn>
                                <HeaderBtn onClick={() => setModal({ kind: "subcategory-edit", categoryId: cat.id, subcategory: sub })}>
                                  ✎
                                </HeaderBtn>
                                <HeaderBtn
                                  danger
                                  onClick={() => del(`/api/subcategories/${sub.id}`, `Fshi nën-kategorinë "${sub.nameAl}"?`)}
                                >
                                  🗑
                                </HeaderBtn>
                              </div>

                              <SortableList
                                ids={sub.items.map((i) => i.id)}
                                onReorder={(ids) => reorderSubcategoryItems(cat.id, sub.id, ids)}
                              >
                                {sub.items.map((item) => (
                                  <SortableItem key={item.id} id={item.id}>
                                    {(hh) => (
                                      <ItemRow
                                        item={item}
                                        handleProps={hh}
                                        onEdit={() => setModal({ kind: "item-edit", item })}
                                        onToggleVisible={() => toggleVisible(item)}
                                        onDelete={() => del(`/api/menu-items/${item.id}`, `Fshi "${item.nameAl}"?`)}
                                      />
                                    )}
                                  </SortableItem>
                                ))}
                              </SortableList>
                              {sub.items.length === 0 && (
                                <p className="text-xs text-alpine-cream/30 pl-6">Pa artikuj.</p>
                              )}
                            </div>
                          )}
                        </SortableItem>
                      ))}
                    </SortableList>

                    {cat.items.length === 0 && cat.subcategories.length === 0 && (
                      <p className="text-sm text-alpine-cream/40 text-center py-3">
                        Kategori bosh — shto një artikull ose nën-kategori.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </SortableItem>
        ))}
      </SortableList>

      {/* Modalet */}
      {modal?.kind === "category-new" && (
        <CategoryModal onClose={() => setModal(null)} onSaved={closeAndRefresh} />
      )}
      {modal?.kind === "category-edit" && (
        <CategoryModal initial={modal.category} onClose={() => setModal(null)} onSaved={closeAndRefresh} />
      )}
      {modal?.kind === "subcategory-new" && (
        <SubcategoryModal categoryId={modal.categoryId} onClose={() => setModal(null)} onSaved={closeAndRefresh} />
      )}
      {modal?.kind === "subcategory-edit" && (
        <SubcategoryModal
          categoryId={modal.categoryId}
          initial={modal.subcategory}
          onClose={() => setModal(null)}
          onSaved={closeAndRefresh}
        />
      )}
      {modal?.kind === "item-new" && (
        <ItemModal parent={modal.parent} onClose={() => setModal(null)} onSaved={closeAndRefresh} />
      )}
      {modal?.kind === "item-edit" && (
        <ItemModal parent={{}} initial={modal.item} onClose={() => setModal(null)} onSaved={closeAndRefresh} />
      )}
    </div>
  );
}

function HeaderBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-md px-2.5 py-1 text-xs hover:bg-alpine-cream/10 transition ${
        danger ? "text-red-400" : "text-alpine-cream/70"
      }`}
    >
      {children}
    </button>
  );
}
