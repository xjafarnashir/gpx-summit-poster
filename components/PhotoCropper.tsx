"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Move, RotateCcw, Trash2, ZoomIn } from "lucide-react";
import {
  DEFAULT_PHOTO_TRANSFORM,
  MAX_ZOOM,
  MIN_ZOOM,
  clampTransform,
  computeImageRect,
} from "@/lib/photoTransform";
import { STAT_ICONS } from "@/lib/iconMap";
import type { PhotoTransform } from "@/types";

interface PhotoCropperProps {
  label: string;
  value?: string;
  transform: PhotoTransform;
  /** Frame aspect ratio (width / height) — matches the poster frame. */
  aspect: number;
  onFile: (file: File) => Promise<void>;
  onTransformChange: (t: PhotoTransform) => void;
  onRemove: () => void;
}

export default function PhotoCropper({
  label,
  value,
  transform,
  aspect,
  onFile,
  onTransformChange,
  onRemove,
}: PhotoCropperProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Track the frame's pixel size so the crop math (normalized) can map to px.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [value]);

  // Read the photo's natural size when it changes. (No synchronous reset here —
  // the render already guards on `value && nat`, so a stale `nat` is never used
  // once `value` is cleared; onload updates it asynchronously for a new photo.)
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = value;
    return () => {
      cancelled = true;
    };
  }, [value]);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        await onFile(file);
      } catch {
        setError("Gagal memproses foto.");
      } finally {
        setBusy(false);
      }
    },
    [onFile]
  );

  // --- Drag to pan ---
  const dragRef = useRef<{ startX: number; startY: number; tf: PhotoTransform } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!value || !nat) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, tf: transform };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !nat) return;
    const rect = computeImageRect(box.w, box.h, nat.w, nat.h, drag.tf);
    const dPanX = rect.ox > 0 ? (2 * (e.clientX - drag.startX)) / rect.ox : 0;
    const dPanY = rect.oy > 0 ? (2 * (e.clientY - drag.startY)) / rect.oy : 0;
    onTransformChange(clampTransform({ ...drag.tf, panX: drag.tf.panX + dPanX, panY: drag.tf.panY + dPanY }));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
  };

  // --- Wheel to zoom (non-passive so we can preventDefault) ---
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !value) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      onTransformChange(clampTransform({ ...transform, zoom: transform.zoom * factor }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [value, transform, onTransformChange]);

  const rect = value && nat ? computeImageRect(box.w, box.h, nat.w, nat.h, transform) : null;
  const canPan = !!rect && (rect.ox > 0.5 || rect.oy > 0.5);

  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <STAT_ICONS.photo size={14} /> {label}
      </div>

      <div
        ref={frameRef}
        style={{ aspectRatio: String(aspect > 0 ? aspect : 1) }}
        onClick={() => {
          if (!value) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative w-full select-none overflow-hidden rounded-lg border-2 ${
          value ? "border-solid border-zinc-200 dark:border-zinc-700" : "border-dashed"
        } ${
          dragOver
            ? "border-[#d97757] bg-[#f7e9e1] dark:bg-[#3a2a22]"
            : value
              ? ""
              : "cursor-pointer border-zinc-300 text-zinc-400 hover:border-[#d97757] hover:bg-[#f7e9e1]/60 dark:border-zinc-700 dark:hover:border-[#a8552f]"
        } ${value && canPan ? "cursor-grab active:cursor-grabbing touch-none" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {busy ? (
          <div className="flex h-full w-full items-center justify-center text-xs">Memproses…</div>
        ) : value && rect ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: `${rect.dx}px`,
                top: `${rect.dy}px`,
                width: `${rect.dw}px`,
                height: `${rect.dh}px`,
              }}
            />
            {canPan && (
              <div className="pointer-events-none absolute left-1 top-1 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                <Move size={11} /> geser
              </div>
            )}
            <div className="absolute right-1 top-1 flex gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTransformChange(DEFAULT_PHOTO_TRANSFORM);
                }}
                className="rounded-full bg-black/55 p-1 text-white transition-colors hover:bg-black/80"
                aria-label="Reset posisi foto"
                title="Reset posisi"
              >
                <RotateCcw size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="rounded-full bg-black/55 p-1 text-white transition-colors hover:bg-red-600"
                aria-label="Hapus foto"
                title="Hapus foto"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-xs">
            <STAT_ICONS.photo size={18} />
            <span>Klik / drag foto</span>
          </div>
        )}
      </div>

      {value && (
        <div className="mt-1.5 flex items-center gap-2">
          <ZoomIn size={13} className="shrink-0 text-zinc-400" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={transform.zoom}
            onChange={(e) => onTransformChange(clampTransform({ ...transform, zoom: Number(e.target.value) }))}
            className="w-full accent-[#d97757]"
            aria-label="Zoom foto"
          />
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
