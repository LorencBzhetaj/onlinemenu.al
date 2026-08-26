"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type HandleProps = Record<string, unknown>;

export function SortableList({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (newIds: string[]) => void;
  children: ReactNode;
}) {
  // Mouse: lëvizje ~6px para drag (lejon klikime normale).
  // Touch: mbaj shtypur 200ms para drag (lejon scroll normal me rrëshqitje) —
  // pa këtë, në telefon scroll-i i shfletuesit konkurron me zvarritjen.
  // Keyboard: aksesueshmëri (Space/Enter për të kapur, shigjetat për të lëvizur).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(ids, oldIndex, newIndex));
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Render-prop: `children` merr props-et që duhen vendosur te dorezuesi (drag handle). */
export function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (handle: HandleProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/** Ikona e dorezuesit (drag handle). */
export function DragHandle({ className = "" }: { className?: string }) {
  return (
    <span
      className={`cursor-grab active:cursor-grabbing text-alpine-cream/30 hover:text-alpine-cream/70 select-none ${className}`}
      aria-label="Zvarrit për të rirenditur"
    >
      ⠿
    </span>
  );
}
