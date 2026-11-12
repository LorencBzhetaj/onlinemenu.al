"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SortableList, SortableItem } from "@/components/menu/sortable";
import { ItemRow } from "@/components/menu/item-row";
import { CategoryModal } from "@/components/menu/category-modal";
import { SubcategoryModal } from "@/components/menu/subcategory-modal";
import { ItemModal } from "@/components/menu/item-modal";
import { AllergenManager } from "@/components/menu/allergen-manager";
import { ScheduleManager } from "@/components/menu/schedule-manager";
import { CategoryIcon } from "@/lib/menu-icons";
import { useApiFetch } from "@/components/restaurant-context";
import type { CategoryDTO, SubcategoryDTO, ItemDTO, AllergenDTO, ScheduleDTO } from "@/lib/menu-types";

type Modal =
  | { kind: "category-new" }
  | { kind: "category-edit"; category: CategoryDTO }
  | { kind: "subcategory-new"; categoryId: string }
  | { kind: "subcategory-edit"; categoryId: string; subcategory: SubcategoryDTO }
  | { kind: "item-new"; parent: { categoryId?: string; subcategoryId?: string } }
  | { kind: "item-edit"; item: ItemDTO }
  | { kind: "allergens" }
  | { kind: "schedules" }
  | null;

export function MenuManager({
  initialTree,
  allergens,
  schedules,
}: {
  initialTree: CategoryDTO[];
  allergens: AllergenDTO[];
  schedules: ScheduleDTO[];
}) {
  const router = useRouter();
  const api = useApiFetch();
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  async function postReorder(type: "category" | "subcategory" | "item", ids: string[]) {
    await api("/api/menu/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ids }),
    });
  }
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
    await api(`/api/menu-items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !item.isVisible }),
    });
    router.refresh();
  }

  async function del(url: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    await api(url, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-ink">Menu</h1>
          <p className="text-muted text-sm mt-1">
            Menaxho kategoritë, nën-kategoritë dhe artikujt. Zvarrit ⠿ për të rirenditur.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setModal({ kind: "schedules" })}
            className="hidden sm:inline-flex whitespace-nowrap min-h-11 items-center rounded-full border border-line px-4 text-sm text-muted hover:border-primary hover:text-primary transition"
          >
            Oraret
          </button>
          <button
            onClick={() => setModal({ kind: "allergens" })}
            className="hidden sm:inline-flex whitespace-nowrap min-h-11 items-center rounded-full border border-line px-4 text-sm text-muted hover:border-primary hover:text-primary transition"
          >
            Alergjenët
          </button>
          <button
            onClick={() => setModal({ kind: "category-new" })}
            className="whitespace-nowrap min-h-11 rounded-full bg-primary px-4 text-sm text-white font-medium hover:bg-primary-dark transition"
          >
            + Kategori
          </button>
        </div>
      </div>

      {/* Qasje te menaxherët edhe në telefon (butonat sipër fshihen nën sm). */}
      <div className="flex gap-2 sm:hidden">
        <button onClick={() => setModal({ kind: "schedules" })} className="flex-1 min-h-11 rounded-full border border-line text-sm text-muted">
          Oraret
        </button>
        <button onClick={() => setModal({ kind: "allergens" })} className="flex-1 min-h-11 rounded-full border border-line text-sm text-muted">
          Alergjenët
        </button>
      </div>

      {tree.length === 0 && (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">
          Ende s&apos;ka kategori. Fillo duke shtuar një kategori.
        </div>
      )}

      <SortableList ids={tree.map((c) => c.id)} onReorder={reorderCategories}>
        {tree.map((cat) => (
          <SortableItem key={cat.id} id={cat.id}>
            {(handle) => (
              <div className="mb-3 rounded-xl border border-line bg-surface">
                {/* Kreu i kategorisë */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span {...handle} className="touch-none px-1 cursor-grab active:cursor-grabbing text-muted hover:text-muted text-lg">
                    ⠿
                  </span>
                  <button onClick={() => toggleExpand(cat.id)} className="text-muted w-4">
                    {expanded.has(cat.id) ? "▾" : "▸"}
                  </button>
                  <CategoryIcon icon={cat.icon} className="w-5 h-5 text-primary" />
                  <div className="min-w-[9rem] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-ink truncate">{cat.nameAl}</span>
                      {cat.scheduleId && scheduleById.has(cat.scheduleId) && (
                        <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[0.65rem] text-primary">
                          🕒 {scheduleById.get(cat.scheduleId)!.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate">{cat.nameEn}</div>
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
                            <div className="rounded-lg border border-line bg-canvas p-3 mb-2">
                              <div className="flex items-center gap-3 mb-2">
                                <span {...h} className="touch-none px-1 cursor-grab active:cursor-grabbing text-muted hover:text-muted">
                                  ⠿
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-muted text-sm">{sub.nameAl}</span>
                                  <span className="text-xs text-muted ml-2">{sub.nameEn}</span>
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
                                <p className="text-xs text-muted pl-6">Pa artikuj.</p>
                              )}
                            </div>
                          )}
                        </SortableItem>
                      ))}
                    </SortableList>

                    {cat.items.length === 0 && cat.subcategories.length === 0 && (
                      <p className="text-sm text-muted text-center py-3">
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
        <CategoryModal schedules={schedules} onClose={() => setModal(null)} onSaved={closeAndRefresh} />
      )}
      {modal?.kind === "category-edit" && (
        <CategoryModal initial={modal.category} schedules={schedules} onClose={() => setModal(null)} onSaved={closeAndRefresh} />
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
        <ItemModal parent={modal.parent} allergens={allergens} onClose={() => setModal(null)} onSaved={closeAndRefresh} />
      )}
      {modal?.kind === "item-edit" && (
        <ItemModal parent={{}} initial={modal.item} allergens={allergens} onClose={() => setModal(null)} onSaved={closeAndRefresh} />
      )}
      {modal?.kind === "allergens" && <AllergenManager allergens={allergens} onClose={() => setModal(null)} />}
      {modal?.kind === "schedules" && <ScheduleManager schedules={schedules} onClose={() => setModal(null)} />}
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
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-2.5 text-xs hover:bg-black/5 transition ${
        danger ? "text-red-600" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}
