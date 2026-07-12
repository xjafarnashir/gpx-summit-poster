import type { PhotoTransform } from "@/types";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const DEFAULT_PHOTO_TRANSFORM: PhotoTransform = { zoom: 1, panX: 0, panY: 0 };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function clampTransform(tf: PhotoTransform): PhotoTransform {
  return {
    zoom: clamp(tf.zoom, MIN_ZOOM, MAX_ZOOM),
    panX: clamp(tf.panX, -1, 1),
    panY: clamp(tf.panY, -1, 1),
  };
}

export interface ImageRect {
  /** Offset of the drawn image relative to the frame's top-left corner. */
  dx: number;
  dy: number;
  /** Drawn image size. */
  dw: number;
  dh: number;
  /** Horizontal / vertical overflow (drawn size − frame size), ≥ 0. */
  ox: number;
  oy: number;
}

/**
 * THE single shared crop math. Given a frame (frameW × frameH), the image's
 * natural size, and a transform, returns where/how big to draw the image so it
 * always covers the frame. Both the DOM cropper preview and the canvas PNG
 * export call this with their own units (px for both, just different scales) —
 * because the transform is normalized (zoom multiplier + pan fraction), the
 * framing is pixel-identical regardless of scale, so the preview is WYSIWYG.
 */
export function computeImageRect(
  frameW: number,
  frameH: number,
  natW: number,
  natH: number,
  tf: PhotoTransform
): ImageRect {
  if (natW <= 0 || natH <= 0 || frameW <= 0 || frameH <= 0) {
    return { dx: 0, dy: 0, dw: frameW, dh: frameH, ox: 0, oy: 0 };
  }
  const t = clampTransform(tf);
  const cover = Math.max(frameW / natW, frameH / natH);
  const s = cover * t.zoom;
  const dw = natW * s;
  const dh = natH * s;
  const ox = Math.max(dw - frameW, 0);
  const oy = Math.max(dh - frameH, 0);
  const dx = -ox / 2 + t.panX * (ox / 2);
  const dy = -oy / 2 + t.panY * (oy / 2);
  return { dx, dy, dw, dh, ox, oy };
}
