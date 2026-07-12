import type { PosterSize, SummitStats } from "@/types";
import { landscapeRightColumn } from "@/lib/projection";

export interface StatItem {
  label: string;
  value: string;
}

/** Rectangle in poster millimeters. */
export interface FrameMm {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
}

export const PHOTO_GAP_MM = 3;

/** Secondary stats shown above the stat divider. Currently empty on portrait —
 *  WAKTU/PACE are first-class stat columns, and SUHU/CUACA live inside the
 *  signature block (grouped with the climber name + socials) so they don't
 *  hang alone above the divider. */
export function computeStatsExtras(stats: SummitStats): StatItem[] {
  const extras: StatItem[] = [];
  void stats;
  return extras;
}

/**
 * Topmost Y (poster mm) used by the bottom stats block — the extras line if
 * present, otherwise the divider. Anything above this (photos, QR, signature)
 * must stay above `topMm - gap` to avoid crowding the stats.
 */
export function computeStatsTopMm(size: PosterSize, stats: SummitStats): number {
  const { heightMm, marginMm } = size;
  const valueSizeMm = heightMm * 0.025;
  const labelSizeMm = heightMm * 0.0102;
  const valuesBaseline = heightMm - marginMm - heightMm * 0.012;
  const labelsBaseline = valuesBaseline - valueSizeMm - heightMm * 0.008;
  const dividerY = labelsBaseline - labelSizeMm - heightMm * 0.016;

  const hasExtras = computeStatsExtras(stats).length > 0;
  if (!hasExtras) return dividerY;

  // With extras (SUHU · CUACA): return a Y that — after the `computeLowerBand`
  // subtracts its usual 0.01h padding — leaves the photo band's bottom edge
  // sitting flush on the baseline of the extras text.
  const exY = dividerY - heightMm * 0.014; // extras text baseline
  return exY + heightMm * 0.01;
}

export interface LowerBand {
  elevTop: number;
  elevHeight: number;
  elevBottom: number;
  innerW: number;
  contentTop: number;
  bandBottom: number;
  rightX0: number;
  rightW: number;
}

/**
 * Geometry of the poster's lower area (elevation band + the title/photos/stats
 * region), in mm. Single source of truth shared by the PNG renderer and the
 * photo cropper so the on-screen crop frame matches the printed frame exactly.
 */
export function computeLowerBand(size: PosterSize, stats: SummitStats): LowerBand {
  const { widthMm, heightMm, marginMm, mapAreaMm } = size;
  const elevTop = mapAreaMm.y + mapAreaMm.height + heightMm * 0.02;
  const elevHeight = heightMm * 0.13;
  const elevBottom = elevTop + elevHeight;
  const innerW = widthMm - marginMm * 2;
  const contentTop = elevBottom + heightMm * 0.022;
  const bandBottom = computeStatsTopMm(size, stats) - heightMm * 0.01;
  const rightX0 = marginMm + innerW * 0.52;
  const rightW = widthMm - marginMm - rightX0;
  return { elevTop, elevHeight, elevBottom, innerW, contentTop, bandBottom, rightX0, rightW };
}

/**
 * The photo frame rectangle(s) in the right column. `count` photos → 1 full-
 * width frame or 2 equal side-by-side frames. Used both to place photos in the
 * PNG and to size the cropper preview (so aspect ratios match).
 */
export function computePhotoFrames(size: PosterSize, stats: SummitStats, count: number): FrameMm[] {
  const { contentTop, bandBottom, rightX0, rightW } = computeLowerBand(size, stats);
  const topMm = contentTop;
  const hMm = Math.max(bandBottom - contentTop, 1);

  if (count <= 1) {
    return [{ xMm: rightX0, yMm: topMm, wMm: rightW, hMm }];
  }
  const w = (rightW - PHOTO_GAP_MM) / 2;
  return [
    { xMm: rightX0, yMm: topMm, wMm: w, hMm },
    { xMm: rightX0 + w + PHOTO_GAP_MM, yMm: topMm, wMm: w, hMm },
  ];
}

/** Landscape photos are capped to this fraction of the poster height and
 *  bottom-anchored just above the signature — keeps them modest, not dominant.
 *  Shared by the renderer (drawLandscapePhotos placement) and the cropper. */
export const LANDSCAPE_PHOTO_MAX_H_FRAC = 0.46;

/** Bottom edge (mm) of the landscape photo band — the photos run down to the
 *  bottom margin (QR + socials live up top, so there's no signature strip). */
export function landscapePhotoBandBottomMm(size: PosterSize): number {
  return size.heightMm - size.marginMm;
}

/**
 * Photo frame rectangle(s) for the LANDSCAPE layout — two modest photos sit in
 * a bottom-anchored band in the right column (above the signature). Both the
 * renderer and the on-screen cropper derive their frame from this so the crop
 * is WYSIWYG with the export.
 */
export function computeLandscapePhotoFrames(size: PosterSize, count: number): FrameMm[] {
  const { x, width } = landscapeRightColumn(size);
  const bottomMm = landscapePhotoBandBottomMm(size);
  const hMm = Math.max(size.heightMm * LANDSCAPE_PHOTO_MAX_H_FRAC, 1);
  const topMm = bottomMm - hMm;

  if (count <= 1) {
    return [{ xMm: x, yMm: topMm, wMm: width, hMm }];
  }
  const w = (width - PHOTO_GAP_MM) / 2;
  return [
    { xMm: x, yMm: topMm, wMm: w, hMm },
    { xMm: x + w + PHOTO_GAP_MM, yMm: topMm, wMm: w, hMm },
  ];
}
