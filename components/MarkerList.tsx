"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Flag, GripVertical, MapPin, Mountain, Tent, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { RouteMarker } from "@/types";

function MarkerIcon({ type }: { type: RouteMarker["type"] }) {
  if (type === "basecamp") return <Tent size={16} className="text-[#c05d3d]" />;
  if (type === "summit") return <Mountain size={16} className="text-red-500" />;
  return <Flag size={16} className="text-amber-500" />;
}

function SortablePosRow({ marker }: { marker: RouteMarker }) {
  const updateMarker = useAppStore((s) => s.updateMarker);
  const removeMarker = useAppStore((s) => s.removeMarker);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: marker.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="clay-tile flex items-center gap-2 px-3 py-2"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <MarkerIcon type="pos" />
      <input
        type="text"
        value={marker.label}
        onChange={(e) => updateMarker(marker.id, { label: e.target.value })}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-800 transition-colors hover:border-zinc-200 focus:border-[#d97757] dark:text-zinc-100 dark:hover:border-zinc-700"
      />
      <button
        type="button"
        onClick={() => removeMarker(marker.id)}
        className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
        aria-label="Hapus pos"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default function MarkerList() {
  const markers = useAppStore((s) => s.markers);
  const updateMarker = useAppStore((s) => s.updateMarker);
  const reorderPosMarkers = useAppStore((s) => s.reorderPosMarkers);

  const basecamp = markers.find((m) => m.type === "basecamp");
  const summit = markers.find((m) => m.type === "summit");
  const posMarkers = markers
    .filter((m) => m.type === "pos")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = posMarkers.map((m) => m.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    reorderPosMarkers(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <div className="clay-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
          <MapPin size={15} />
        </span>
        Titik Rute
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Basecamp & puncak otomatis dari GPX. Tambah pos lewat peta, lalu drag untuk urutkan.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {basecamp && (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-[#efece3] px-3 py-2 dark:border-zinc-800 dark:bg-[#262624]">
            <MarkerIcon type="basecamp" />
            <input
              type="text"
              value={basecamp.label}
              onChange={(e) => updateMarker(basecamp.id, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-200 focus:border-[#d97757] dark:text-zinc-100 dark:hover:border-zinc-700"
            />
          </div>
        )}

        {posMarkers.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={posMarkers.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2 py-1 pl-2">
                {posMarkers.map((m) => (
                  <SortablePosRow key={m.id} marker={m} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {summit && (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-red-50 px-3 py-2 dark:border-zinc-800 dark:bg-red-950/30">
            <MarkerIcon type="summit" />
            <input
              type="text"
              value={summit.label}
              onChange={(e) => updateMarker(summit.id, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-200 focus:border-[#d97757] dark:text-zinc-100 dark:hover:border-zinc-700"
            />
          </div>
        )}
      </div>
    </div>
  );
}
