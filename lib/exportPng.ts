import type { GpxParseResult, PhotoTransform, PosterSize, RouteMarker, SummitStats, ThemeSettings } from "@/types";
import {
  isLandscapeSize,
  landscapeRightColumn,
  mapAreaLatLonBounds,
  mapAreaRotatedBasemap,
  projectRoute,
  toPosterMm,
} from "@/lib/projection";
import { basemapAttribution, fetchStitchedBasemap } from "@/lib/tileFetcher";
import { generateQrDataUrl } from "@/lib/qr";
import { haversineMeters } from "@/lib/geo";
import { MARKER_COLORS } from "@/lib/mapIcons";
import { DEFAULT_PHOTO_TRANSFORM, computeImageRect } from "@/lib/photoTransform";
import { bgThemeById } from "@/lib/backgroundThemes";
import { hikerIconImage } from "@/lib/hikerIcon";
import { getIconImage } from "@/lib/canvasIcons";
import { Calendar, MapPin } from "lucide-react";
import {
  LANDSCAPE_PHOTO_MAX_H_FRAC,
  PHOTO_GAP_MM,
  computeLowerBand,
  computePhotoFrames,
  computeStatsExtras,
  type StatItem,
} from "@/lib/posterLayout";

export interface RenderPosterParams {
  posterSize: PosterSize;
  gpxData: GpxParseResult;
  markers: RouteMarker[];
  stats: SummitStats;
  theme: ThemeSettings;
  registrationMarks: boolean;
  pxPerMm: number;
}

/* ---- Palette (sunset gradient, matching the reference design) ---- */
const CREAM = "#fbf5ea";
const CREAM_SOFT = "rgba(251,245,234,0.82)";
const CREAM_MUTED = "rgba(251,245,234,0.62)";
const CREAM_FAINT = "rgba(251,245,234,0.32)";
const GOLD = "#ffcf8a";

/** Sets a soft drop shadow for legible text over the map/gradient. */
function setTextShadow(ctx: CanvasRenderingContext2D, blurPx: number, dy = 0, alpha = 0.55) {
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blurPx;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = dy;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

const MONO = '"Courier New", ui-monospace, monospace';
const SANS = '"Arial Narrow", "Arial", sans-serif';

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal load gambar."));
    img.src = url;
  });
}

/**
 * Draws the optional user background photo over the sunset gradient, cover-fit
 * across the whole poster, at `theme.backgroundImageOpacity`. The gradient
 * underneath still shows through by (1 − opacity), so the sunset never fully
 * disappears — it just gets a photographic backdrop mixed in.
 */
async function drawBackgroundImage(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  theme: ThemeSettings
) {
  if (!theme.backgroundImage) return;
  const alpha = Math.max(0, Math.min(1, theme.backgroundImageOpacity ?? 0.5));
  if (alpha <= 0) return;
  try {
    const img = await loadImageFromUrl(theme.backgroundImage);
    const cw = canvas.width;
    const ch = canvas.height;
    // Shared crop math (same as the on-screen cropper) → zoom/pan is WYSIWYG.
    const tf = theme.backgroundImageTransform ?? DEFAULT_PHOTO_TRANSFORM;
    const rect = computeImageRect(cw, ch, img.width, img.height, tf);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, rect.dx, rect.dy, rect.dw, rect.dh);
    ctx.restore();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[background image failed to load]", e);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  } catch {
    /* older browsers: ignore */
  }
}

function formatCoord(lat: number, lon: number): string {
  const latH = lat >= 0 ? "N" : "S";
  const lonH = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${latH} ${Math.abs(lon).toFixed(3)}°${lonH}`;
}

export async function renderPoster(params: RenderPosterParams): Promise<HTMLCanvasElement> {
  if (isLandscapeSize(params.posterSize)) return renderPosterLandscape(params);

  const { posterSize, gpxData, markers, stats, theme, registrationMarks, pxPerMm } = params;
  const mm = (v: number) => v * pxPerMm;
  const { widthMm, heightMm, marginMm, mapAreaMm } = posterSize;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mm(widthMm));
  canvas.height = Math.round(mm(heightMm));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context tidak tersedia.");

  // 1. Background gradient (navy -> amber), then optional photo backdrop on top.
  // 1a. Background gradient (navy -> amber)
  ctx.save();
  if (theme.gradientBrightness && theme.gradientBrightness !== 1) {
    ctx.filter = `brightness(${theme.gradientBrightness})`;
  }
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  for (const [stop, color] of bgThemeById(theme.backgroundTheme).stops) bg.addColorStop(stop, color);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // 1b. Optional photo backdrop on top
  ctx.save();
  if (theme.backgroundImageBrightness && theme.backgroundImageBrightness !== 1) {
    ctx.filter = `brightness(${theme.backgroundImageBrightness})`;
  }
  await drawBackgroundImage(ctx, canvas, theme);
  ctx.restore();

  // 2. Frame + corner brackets
  drawFrame(ctx, posterSize, mm);

  // 3. Header
  const summitPoint = getSummitPoint(gpxData, markers);
  drawHeader(ctx, posterSize, summitPoint, stats.headerLabel || "RUTE PENDAKIAN", mm);

  // 4. Map box (basemap + gradient tint + border)
  await drawMapBox(ctx, posterSize, gpxData, theme, mm);

  // 5. Route + markers + registration
  drawRoute(ctx, posterSize, gpxData, mm, { rotationDeg: theme.mapRotationDeg });
  drawMarkers(ctx, posterSize, gpxData, markers, mm, theme.mapRotationDeg);
  if (registrationMarks) drawRegistrationMarks(ctx, mapAreaMm, mm);

  // 6. Elevation profile — geometry comes from the shared lower-band helper
  //    so the photo cropper on-screen matches the printed frame exactly.
  const band = computeLowerBand(posterSize, stats);
  const { elevTop, elevHeight, elevBottom, rightX0, contentTop, bandBottom } = band;
  drawElevationProfile(ctx, gpxData, markers, marginMm, elevTop, widthMm - marginMm * 2, elevHeight, heightMm, mm);

  // 6b. Legibility scrim: darkens the lower band so cream text always reads,
  // regardless of how bright the amber gradient gets underneath it.
  const scrim = ctx.createLinearGradient(0, mm(elevBottom), 0, canvas.height);
  scrim.addColorStop(0, "rgba(18,12,28,0)");
  scrim.addColorStop(0.45, "rgba(18,12,28,0.28)");
  scrim.addColorStop(1, "rgba(12,8,20,0.62)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, mm(elevBottom), canvas.width, canvas.height - mm(elevBottom));

  // Lower area layout: left column (title/subtitle) + right column (photos/QR),
  // with the stats row anchored along the bottom.
  const photoItems = [
    { src: stats.summitPhoto, tf: stats.summitPhotoTransform },
    { src: stats.landscapePhoto, tf: stats.landscapePhotoTransform },
  ].filter((p): p is { src: string; tf: PhotoTransform } => !!p.src);
  const rightUsed = photoItems.length > 0;
  const leftMaxW = (rightUsed ? rightX0 - heightMm * 0.01 : widthMm - marginMm) - marginMm;

  // 7. Title (auto-shrink to fit the left column) + subtitle
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  setLetterSpacing(ctx, 0);
  const title = (stats.mountainName || "GUNUNG").toUpperCase();
  let titleSizeMm = heightMm * 0.052;
  ctx.font = `700 ${mm(titleSizeMm)}px ${SANS}`;
  while (ctx.measureText(title).width > mm(leftMaxW) && titleSizeMm > heightMm * 0.02) {
    titleSizeMm *= 0.94;
    ctx.font = `700 ${mm(titleSizeMm)}px ${SANS}`;
  }
  const titleBaseline = contentTop + titleSizeMm;
  setTextShadow(ctx, mm(1.6), mm(0.4), 0.5);
  ctx.fillStyle = CREAM;
  ctx.fillText(title, mm(marginMm), mm(titleBaseline));
  clearShadow(ctx);

  // thin accent underline beneath the title
  ctx.fillStyle = GOLD;
  ctx.fillRect(mm(marginMm), mm(titleBaseline + heightMm * 0.006), mm(Math.min(leftMaxW, titleSizeMm * 1.4)), mm(0.8));

  // "VIA <route>" subtitle — same treatment as landscape (strip a redundant
  // leading "via" the user may have typed, then uppercase).
  let subtitleBottomMm = titleBaseline + heightMm * 0.008; // fallback gap if no subtitle
  if (stats.viaRoute) {
    const via = stats.viaRoute.trim().replace(/^via\s+/i, "");
    const subSizeMm = heightMm * 0.016;
    ctx.font = `600 ${mm(subSizeMm)}px "Arial", sans-serif`;
    setLetterSpacing(ctx, 0.5);
    setTextShadow(ctx, mm(1), mm(0.3), 0.45);
    ctx.fillStyle = CREAM_SOFT;
    subtitleBottomMm = titleBaseline + subSizeMm + heightMm * 0.016;
    ctx.fillText(`VIA ${via.toUpperCase()}`, mm(marginMm), mm(subtitleBottomMm));
    clearShadow(ctx);
    setLetterSpacing(ctx, 0);
  }

  // 7b. Meta line: date with calendar icon. Climber name lives in the
  // signature block (above the socials) now, so it's not duplicated here.
  let metaBottomMm = subtitleBottomMm;
  const metaItems: { icon: typeof MapPin; text: string }[] = [];
  if (stats.date) metaItems.push({ icon: Calendar, text: stats.date.toUpperCase() });
  if (metaItems.length > 0) {
    const metaSize = heightMm * 0.013;
    const iconMm = metaSize * 1.15;
    metaBottomMm = subtitleBottomMm + heightMm * 0.02 + metaSize;
    ctx.font = `600 ${mm(metaSize)}px "Arial", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    let mx = marginMm;
    for (const item of metaItems) {
      const icon = await getIconImage(item.icon, "#ffcf8a", 48);
      ctx.drawImage(icon, mm(mx), mm(metaBottomMm - iconMm * 0.82), mm(iconMm), mm(iconMm));
      mx += iconMm + heightMm * 0.006;
      ctx.fillStyle = CREAM_SOFT;
      setTextShadow(ctx, mm(0.8), mm(0.2), 0.4);
      ctx.fillText(item.text, mm(mx), mm(metaBottomMm));
      clearShadow(ctx);
      mx += measureMm(ctx, item.text, mm) + heightMm * 0.026;
    }
  }

  // 8a. Photos in the right column (never over the map).
  if (photoItems.length > 0) {
    await drawPhotos(ctx, photoItems, posterSize, stats, mm);
  }

  // 8b. Signature block (QR + socials), placed with a clear gap below the meta
  // line and clamped above the stats block. (Climber name lives in the meta
  // line now, so the signature is just the QR + social handles.)
  const signatureTopMm = metaBottomMm + heightMm * 0.016;
  // Signature must not overflow into the photo column on the right.
  const sigMaxRight = rightX0 - heightMm * 0.008;
  await drawSignature(ctx, stats, marginMm, signatureTopMm, bandBottom, heightMm, mm, sigMaxRight);

  // 9. Stats row (JARAK · ELEV. GAIN · PUNCAK · TANGGAL + optional extras)
  drawStatsRow(ctx, posterSize, gpxData, stats, mm);

  // 10. Attribution
  ctx.font = `${mm(heightMm * 0.006)}px ${MONO}`;
  ctx.fillStyle = CREAM_MUTED;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  setLetterSpacing(ctx, 1);
  ctx.fillText(
    basemapAttribution(theme.theme).toUpperCase(),
    mm(widthMm - marginMm),
    mm(heightMm - marginMm * 0.55)
  );
  setLetterSpacing(ctx, 0);

  return canvas;
}

/* ============================================================================
 * LANDSCAPE RENDERER
 * Two-column magazine layout (per the landscape reference): a tall map fills
 * the left column; the title, climber/date, stat cards, photos and signature
 * flow down the right column. Shares the sunset palette + map treatment with
 * the portrait renderer so both orientations stay on-brand.
 * ========================================================================== */
async function renderPosterLandscape(params: RenderPosterParams): Promise<HTMLCanvasElement> {
  const { posterSize, gpxData, markers, stats, theme, registrationMarks, pxPerMm } = params;
  const mm = (v: number) => v * pxPerMm;
  const { widthMm, heightMm, marginMm, mapAreaMm } = posterSize;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mm(widthMm));
  canvas.height = Math.round(mm(heightMm));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context tidak tersedia.");

  // 1. Background gradient + optional photo backdrop + frame (shared w/ portrait).
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  for (const [stop, color] of bgThemeById(theme.backgroundTheme).stops) bg.addColorStop(stop, color);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await drawBackgroundImage(ctx, canvas, theme);
  drawFrame(ctx, posterSize, mm);

  // 2. Left column: map + route + markers. Lighter tint so the trails/terrain
  //    read through, and a cased (dark-outlined) route so it stays crisp on it.
  await drawMapBox(ctx, posterSize, gpxData, theme, mm, { tintScale: 0.45 });
  drawRoute(ctx, posterSize, gpxData, mm, { casing: true, widthScale: 1.15, rotationDeg: theme.mapRotationDeg });
  drawMarkers(ctx, posterSize, gpxData, markers, mm, theme.mapRotationDeg);
  if (registrationMarks) drawRegistrationMarks(ctx, mapAreaMm, mm);

  // Attribution on a small dark pill in the map's bottom-left corner, so it
  // stays legible on light basemaps (topo/light) without cluttering the map.
  {
    const attr = basemapAttribution(theme.theme).toUpperCase();
    const attrSize = heightMm * 0.007;
    ctx.font = `${mm(attrSize)}px ${MONO}`;
    setLetterSpacing(ctx, 1);
    const tw = ctx.measureText(attr).width;
    const padX = mm(1.6);
    const padY = mm(1);
    const bx = mm(mapAreaMm.x + 2);
    const by = mm(mapAreaMm.y + mapAreaMm.height - 2);
    ctx.fillStyle = "rgba(12,9,22,0.6)";
    roundRect(ctx, bx, by - mm(attrSize) - padY * 2, tw + padX * 2, mm(attrSize) + padY * 2, mm(1));
    ctx.fill();
    ctx.fillStyle = CREAM_SOFT;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(attr, bx + padX, by - padY);
    setLetterSpacing(ctx, 0);
  }

  // 2b. Elevation profile — a slim strip beneath the map in the left column,
  //     wrapped in a dark rounded panel so the cream/gold chart reads over the
  //     warm gradient. Mirrors the portrait layout (map → elevation).
  const contentH = heightMm - marginMm * 2;
  const elevTop = mapAreaMm.y + mapAreaMm.height + contentH * 0.03;
  const elevBottom = heightMm - marginMm;
  const elevH = elevBottom - elevTop;
  if (elevH > 12) {
    ctx.fillStyle = "rgba(15,10,26,0.55)";
    roundRect(ctx, mm(mapAreaMm.x), mm(elevTop), mm(mapAreaMm.width), mm(elevH), mm(2.5));
    ctx.fill();
    ctx.strokeStyle = "rgba(251,245,234,0.16)";
    ctx.lineWidth = mm(0.25);
    roundRect(ctx, mm(mapAreaMm.x), mm(elevTop), mm(mapAreaMm.width), mm(elevH), mm(2.5));
    ctx.stroke();

    const padX = mapAreaMm.width * 0.05;
    const padY = elevH * 0.12;
    drawElevationProfile(
      ctx,
      gpxData,
      markers,
      mapAreaMm.x + padX,
      elevTop + padY,
      mapAreaMm.width - padX * 2,
      elevH - padY * 2,
      heightMm,
      mm
    );
  }

  // 3. Right column geometry.
  const { x: rx, width: rw, gap } = landscapeRightColumn(posterSize);
  const contentBottom = heightMm - marginMm;
  let cursor = marginMm;

  // --- 3a. Eyebrow: flag + region label (left) · summit coordinate (right) ---
  const flagH = heightMm * 0.028;
  const flagW = flagH * 1.5;
  drawIndonesiaFlag(ctx, rx, cursor, flagW, flagH, mm);

  const eyebrowMidMm = cursor + flagH / 2;
  const eyebrowSize = heightMm * 0.015;
  ctx.font = `${mm(eyebrowSize)}px ${MONO}`;
  ctx.fillStyle = CREAM_SOFT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  setLetterSpacing(ctx, 2);
  const region = (stats.headerLabel || "RUTE PENDAKIAN").toUpperCase();
  ctx.fillText(region, mm(rx + flagW + gap * 0.5), mm(eyebrowMidMm));
  setLetterSpacing(ctx, 0);

  cursor += flagH + heightMm * 0.032;

  // The Strava QR is drawn lower (top aligned with the VIA subtitle, bottom at
  // the socials line, left edge on the WAKTU stat column) — see below. The
  // title sits above it and uses the full right-column width.
  const titleMaxW = rw;

  // --- 3b. Title (auto-shrink + wrap up to 2 lines) ---
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const title = (stats.mountainName || "GUNUNG").toUpperCase();
  let titleSizeMm = heightMm * 0.06;
  const minTitleMm = heightMm * 0.03;
  let titleLines: string[] = [title];
  for (;;) {
    ctx.font = `700 ${mm(titleSizeMm)}px ${SANS}`;
    titleLines = wrapText(ctx, title, mm(titleMaxW));
    if (titleLines.length <= 2 || titleSizeMm <= minTitleMm) break;
    titleSizeMm *= 0.94;
  }
  titleLines = titleLines.slice(0, 2);
  const titleLineH = titleSizeMm * 1.05;
  setTextShadow(ctx, mm(1.6), mm(0.4), 0.5);
  ctx.fillStyle = CREAM;
  titleLines.forEach((line, i) => {
    cursor += titleSizeMm;
    ctx.fillText(line, mm(rx), mm(cursor));
    if (i < titleLines.length - 1) cursor += titleLineH - titleSizeMm;
  });
  clearShadow(ctx);

  // gold underline beneath the title
  ctx.fillStyle = GOLD;
  const underlineY = cursor + heightMm * 0.009;
  ctx.fillRect(mm(rx), mm(underlineY), mm(Math.min(rw, titleSizeMm * 2.4)), mm(1.2));
  cursor = underlineY + heightMm * 0.008;

  // Top of the QR band — starts at the VIA subtitle (set below), or here if
  // there is no subtitle.
  let qrTopMm = cursor;

  // --- 3c. Subtitle: VIA <route> (strip a redundant leading "via" the user
  //         may have typed, so we never render "VIA VIA ...") ---
  if (stats.viaRoute) {
    const via = stats.viaRoute.trim().replace(/^via\s+/i, "");
    const subSize = heightMm * 0.022;
    cursor += subSize + heightMm * 0.016;
    qrTopMm = cursor - subSize; // align the QR's top with the VIA text
    ctx.font = `600 ${mm(subSize)}px "Arial", sans-serif`;
    ctx.fillStyle = CREAM_SOFT;
    setLetterSpacing(ctx, 1);
    setTextShadow(ctx, mm(1), mm(0.3), 0.45);
    ctx.fillText(`VIA ${via.toUpperCase()}`, mm(rx), mm(cursor));
    clearShadow(ctx);
    setLetterSpacing(ctx, 0);
  }

  // --- 3d. Climber + date row (mini icons). Nama pendaki pakai ikon hiker
  //         (sama dengan poster koleksi); tanggal pakai ikon kalender. ---
  const metaItems: { icon: typeof MapPin | null; text: string }[] = [];
  if (stats.climberName) metaItems.push({ icon: null, text: stats.climberName });
  if (stats.date) metaItems.push({ icon: Calendar, text: stats.date.toUpperCase() });
  if (metaItems.length > 0) {
    const metaSize = heightMm * 0.0175;
    const iconMm = metaSize * 1.15;
    cursor += metaSize + heightMm * 0.026;
    ctx.font = `600 ${mm(metaSize)}px "Arial", sans-serif`;
    ctx.textBaseline = "alphabetic";
    let mx = rx;
    for (const item of metaItems) {
      const hikerMm = item.icon ? iconMm : iconMm * 1.35;
      const icon = item.icon ? await getIconImage(item.icon, "#ffcf8a", 48) : await hikerIconImage("#ffcf8a", 72);
      ctx.drawImage(icon, mm(mx), mm(cursor - hikerMm * 0.82), mm(hikerMm), mm(hikerMm));
      mx += hikerMm + heightMm * 0.006;
      ctx.fillStyle = CREAM_SOFT;
      setTextShadow(ctx, mm(0.8), mm(0.2), 0.4);
      ctx.fillText(item.text, mm(mx), mm(cursor));
      clearShadow(ctx);
      mx += measureMm(ctx, item.text, mm) + heightMm * 0.03;
    }
  }

  // --- 3d2. Social handles, directly under the name + date ---
  const socials: string[] = [];
  if (stats.instagram) socials.push(`IG ${stats.instagram.startsWith("@") ? stats.instagram : "@" + stats.instagram}`);
  if (stats.tiktok) socials.push(`TT ${stats.tiktok.startsWith("@") ? stats.tiktok : "@" + stats.tiktok}`);
  if (socials.length > 0) {
    const socSize = heightMm * 0.016;
    cursor += socSize + heightMm * 0.015;
    ctx.font = `600 ${mm(socSize)}px "Arial", sans-serif`;
    ctx.fillStyle = CREAM_SOFT;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    setTextShadow(ctx, mm(0.8), mm(0.2), 0.4);
    ctx.fillText(socials.join("   ·   "), mm(rx), mm(cursor));
    clearShadow(ctx);
  }

  // --- 3e. Stat row values. PACE joins the primary metrics (KETINGGIAN, JARAK,
  //         ELEV GAIN, WAKTU) when present. ---
  const summitEle = stats.summitElevationM || Math.round(gpxData.maxEle);
  const cards: { value: string; unit: string; label: string }[] = [
    { value: `${Math.round(summitEle)}`, unit: "MDPL", label: "KETINGGIAN" },
    { value: stats.distanceKm.toFixed(2), unit: "KM", label: "JARAK" },
    { value: `+${Math.round(stats.elevationGainM)}`, unit: "M", label: "ELEV GAIN" },
    { value: stats.movingTime && stats.movingTime !== "00:00:00" ? stats.movingTime : "—", unit: "", label: "WAKTU" },
  ];
  if (stats.avgPace) {
    const [pv, pu] = stats.avgPace.split("/");
    cards.push({ value: pv.trim(), unit: pu ? `/${pu.toUpperCase()}` : "", label: "PACE" });
  }

  // --- 3d3. Strava QR: spans from the VIA subtitle down to the socials line;
  //          its RIGHT edge is aligned with the right edge of the last stat
  //          column's text (the "/KM" of PACE), never overshooting it. ---
  if (stats.qrCodeUrl) {
    const n = cards.length;
    const colW = rw / n;
    const last = cards[n - 1];
    ctx.font = `700 ${mm(heightMm * 0.032)}px ${SANS}`;
    let textRight = rx + (n - 1) * colW + measureMm(ctx, last.value, mm);
    if (last.unit) {
      ctx.font = `600 ${mm(heightMm * 0.013)}px "Arial", sans-serif`;
      textRight += colW * 0.028 + measureMm(ctx, last.unit, mm);
    }
    const side = Math.min(cursor - qrTopMm, rw * 0.3);
    if (side > 6) await drawQrBox(ctx, stats.qrCodeUrl, textRight - side, qrTopMm, side, mm);
  }

  const cardsTop = cursor + heightMm * 0.036;
  // Height that hugs the actual content (rule + label + hero value) — no dead
  // space between the stat row and the photos below it.
  const cardsH = heightMm * 0.085;
  drawLandscapeStatRow(ctx, cards, rx, cardsTop, rw, cardsH, heightMm, mm);
  const afterCards = cardsTop + cardsH;

  // --- 3f. Photos, with a SUHU · CUACA caption line beneath them. ---
  const weather: StatItem[] = [];
  if (stats.temperature) weather.push({ label: "SUHU", value: stats.temperature });
  if (stats.weather) weather.push({ label: "CUACA", value: stats.weather });
  const weatherLineH = weather.length > 0 ? heightMm * 0.04 : 0;

  const bandTop = afterCards + heightMm * 0.022;
  const bandBottom = contentBottom - weatherLineH;
  const photoH = Math.min(bandBottom - bandTop, heightMm * LANDSCAPE_PHOTO_MAX_H_FRAC);
  const photoBottom = bandTop + photoH;
  await drawLandscapePhotos(ctx, stats, rx, bandTop, rw, photoH, mm);

  if (weather.length > 0) {
    const wSize = heightMm * 0.016;
    const wY = photoBottom + heightMm * 0.018 + wSize;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    // Shadow the whole line: gold/cream over the warm amber bottom needs the
    // lift or it sinks into the gradient.
    setTextShadow(ctx, mm(1), mm(0.3), 0.5);
    let wx = rx;
    weather.forEach((e, i) => {
      if (i > 0) {
        ctx.font = `${mm(wSize)}px "Arial", sans-serif`;
        ctx.fillStyle = CREAM_MUTED;
        ctx.fillText("·", mm(wx), mm(wY));
        wx += measureMm(ctx, "·", mm) + heightMm * 0.016;
      }
      ctx.font = `${mm(wSize)}px ${MONO}`;
      ctx.fillStyle = GOLD;
      setLetterSpacing(ctx, 0.5);
      ctx.fillText(e.label, mm(wx), mm(wY));
      wx += measureMm(ctx, e.label, mm) + heightMm * 0.006;
      setLetterSpacing(ctx, 0);

      const val = e.value.toUpperCase();
      ctx.font = `600 ${mm(wSize)}px "Arial", sans-serif`;
      ctx.fillStyle = CREAM;
      ctx.fillText(val, mm(wx), mm(wY));
      wx += measureMm(ctx, val, mm) + heightMm * 0.016;
    });
    clearShadow(ctx);
  }

  return canvas;
}

/** Small Indonesian flag (red over white) with a thin frame. */
function drawIndonesiaFlag(
  ctx: CanvasRenderingContext2D,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  mm: (v: number) => number
) {
  ctx.save();
  ctx.fillStyle = "#e70011";
  ctx.fillRect(mm(xMm), mm(yMm), mm(wMm), mm(hMm / 2));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(mm(xMm), mm(yMm + hMm / 2), mm(wMm), mm(hMm / 2));
  ctx.strokeStyle = "rgba(251,245,234,0.5)";
  ctx.lineWidth = mm(0.2);
  ctx.strokeRect(mm(xMm), mm(yMm), mm(wMm), mm(hMm));
  ctx.restore();
}

/** Greedy word-wrap for the current ctx font; returns one string per line. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidthPx) line = test;
    else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Editorial stat row (no icons, no boxes). A thin rule with a gold accent tick
 * anchors the band; under it each column is a tracked micro-label above a big
 * hero number with a small inline unit. Deliberately understated/magazine-like
 * — the opposite of the icon-per-metric "dashboard" look.
 */
function drawLandscapeStatRow(
  ctx: CanvasRenderingContext2D,
  cards: { value: string; unit: string; label: string }[],
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  heightMm: number,
  mm: (v: number) => number
) {
  const n = cards.length;
  const colW = wMm / n;
  const valueSize = heightMm * 0.032;
  const unitSize = heightMm * 0.014;
  const labelSize = heightMm * 0.0122;

  // Top rule across the band, with a short gold accent tick at the left.
  ctx.strokeStyle = "rgba(251,245,234,0.22)";
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.moveTo(mm(xMm), mm(yMm));
  ctx.lineTo(mm(xMm + wMm), mm(yMm));
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.fillRect(mm(xMm), mm(yMm - 0.5), mm(wMm * 0.14), mm(1));

  const labelBaseline = yMm + labelSize + heightMm * 0.024;
  const valueBaseline = labelBaseline + valueSize + heightMm * 0.006;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (let i = 0; i < n; i++) {
    const ix = xMm + i * colW;

    // tracked micro-label on top
    ctx.font = `${mm(labelSize)}px ${MONO}`;
    ctx.fillStyle = GOLD;
    setLetterSpacing(ctx, 1.5);
    ctx.fillText(cards[i].label, mm(ix), mm(labelBaseline));
    setLetterSpacing(ctx, 0);

    // hero number + small inline unit
    ctx.font = `700 ${mm(valueSize)}px ${SANS}`;
    setTextShadow(ctx, mm(0.8), mm(0.2), 0.45);
    ctx.fillStyle = CREAM;
    ctx.fillText(cards[i].value, mm(ix), mm(valueBaseline));
    const valW = measureMm(ctx, cards[i].value, mm);
    clearShadow(ctx);
    if (cards[i].unit) {
      ctx.font = `600 ${mm(unitSize)}px "Arial", sans-serif`;
      ctx.fillStyle = CREAM_SOFT;
      ctx.fillText(cards[i].unit, mm(ix + valW + colW * 0.028), mm(valueBaseline));
    }
  }
}

/** One or two photos side-by-side, filling the given band in the right column. */
async function drawLandscapePhotos(
  ctx: CanvasRenderingContext2D,
  stats: SummitStats,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  mm: (v: number) => number
) {
  if (hMm < 8) return;
  const photos = [
    { src: stats.summitPhoto, tf: stats.summitPhotoTransform },
    { src: stats.landscapePhoto, tf: stats.landscapePhotoTransform },
  ].filter((p): p is { src: string; tf: PhotoTransform } => !!p.src);
  if (photos.length === 0) return;

  if (photos.length === 1) {
    await drawRoundedImage(ctx, photos[0].src, xMm, yMm, wMm, hMm, mm, photos[0].tf, true);
    return;
  }
  const w = (wMm - PHOTO_GAP_MM) / 2;
  await drawRoundedImage(ctx, photos[0].src, xMm, yMm, w, hMm, mm, photos[0].tf, true);
  await drawRoundedImage(ctx, photos[1].src, xMm + w + PHOTO_GAP_MM, yMm, w, hMm, mm, photos[1].tf, true);
}

/** White rounded QR tile (used for the top-right Strava code on landscape). */
async function drawQrBox(
  ctx: CanvasRenderingContext2D,
  url: string,
  xMm: number,
  yMm: number,
  sizeMm: number,
  mm: (v: number) => number
) {
  const qrUrl = await generateQrDataUrl(url, 400);
  if (!qrUrl) return;
  try {
    const img = await loadImageFromUrl(qrUrl);
    const pad = sizeMm * 0.08;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, mm(xMm), mm(yMm), mm(sizeMm), mm(sizeMm), mm(1.6));
    ctx.fill();
    ctx.drawImage(img, mm(xMm + pad), mm(yMm + pad), mm(sizeMm - pad * 2), mm(sizeMm - pad * 2));
  } catch {
    /* ignore */
  }
}

function getSummitPoint(gpxData: GpxParseResult, markers: RouteMarker[]) {
  const summit = markers.find((m) => m.type === "summit");
  const idx = summit?.trackIndex ?? gpxData.points.length - 1;
  return gpxData.points[idx] ?? gpxData.points[gpxData.points.length - 1];
}

function drawFrame(ctx: CanvasRenderingContext2D, size: PosterSize, mm: (v: number) => number) {
  const { widthMm, heightMm, marginMm } = size;
  const x = mm(marginMm);
  const y = mm(marginMm);
  const w = mm(widthMm - marginMm * 2);
  const h = mm(heightMm - marginMm * 2);

  // faint full frame
  ctx.strokeStyle = CREAM_FAINT;
  ctx.lineWidth = mm(0.2);
  ctx.strokeRect(x, y, w, h);

  // stronger corner brackets
  ctx.strokeStyle = CREAM_MUTED;
  ctx.lineWidth = mm(0.45);
  const len = mm(14);
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * len);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * len, cy);
    ctx.stroke();
  }
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  size: PosterSize,
  summitPoint: { lat: number; lon: number },
  headerLabel: string,
  mm: (v: number) => number
) {
  const { widthMm, heightMm, marginMm, mapAreaMm } = size;
  const headerY = marginMm + (mapAreaMm.y - marginMm) * 0.5;
  const labelSizeMm = heightMm * 0.0105;

  ctx.font = `${mm(labelSizeMm)}px ${MONO}`;
  ctx.fillStyle = CREAM_SOFT;
  ctx.textBaseline = "middle";
  setLetterSpacing(ctx, 3);

  // Indonesian flag before the header label (matches the landscape eyebrow).
  const flagH = heightMm * 0.014;
  const flagW = flagH * 1.5;
  drawIndonesiaFlag(ctx, marginMm + 3, headerY - flagH / 2, flagW, flagH, mm);

  ctx.fillStyle = CREAM_SOFT;
  ctx.textAlign = "left";
  ctx.fillText(headerLabel.toUpperCase(), mm(marginMm + 3 + flagW + 3), mm(headerY));

  ctx.textAlign = "right";
  ctx.fillText(formatCoord(summitPoint.lat, summitPoint.lon), mm(widthMm - marginMm - 3), mm(headerY));

  setLetterSpacing(ctx, 0);

  // divider line under header
  ctx.strokeStyle = CREAM_FAINT;
  ctx.lineWidth = mm(0.25);
  const dy = mm(headerY + labelSizeMm * 1.6);
  ctx.beginPath();
  ctx.moveTo(mm(marginMm + 3), dy);
  ctx.lineTo(mm(widthMm - marginMm - 3), dy);
  ctx.stroke();
}

async function drawMapBox(
  ctx: CanvasRenderingContext2D,
  size: PosterSize,
  gpxData: GpxParseResult,
  theme: ThemeSettings,
  mm: (v: number) => number,
  options?: { tintScale?: number }
) {
  const { mapAreaMm } = size;
  const mx = mm(mapAreaMm.x);
  const my = mm(mapAreaMm.y);
  const mw = mm(mapAreaMm.width);
  const mh = mm(mapAreaMm.height);

  const rot = theme.mapRotationDeg ?? 0;
  try {
    if (rot) {
      // Rotated map: fetch a north-up square covering the box's diagonal,
      // then draw it rotated around the box center, clipped to the box —
      // keeps the basemap pixel-aligned with the rotated route.
      const sq = mapAreaRotatedBasemap(size, gpxData.points, rot);
      if (sq) {
        const sidePx = Math.round(mm(sq.sideMm));
        const basemap = await fetchStitchedBasemap(sq, sidePx, sidePx, theme.theme);
        ctx.save();
        ctx.beginPath();
        ctx.rect(mx, my, mw, mh);
        ctx.clip();
        ctx.translate(mx + mw / 2, my + mh / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(basemap, -sidePx / 2, -sidePx / 2, sidePx, sidePx);
        ctx.restore();
      }
    } else {
      const bounds = mapAreaLatLonBounds(size, gpxData.points);
      if (bounds) {
        const basemap = await fetchStitchedBasemap(bounds, Math.round(mw), Math.round(mh), theme.theme);
        ctx.drawImage(basemap, mx, my, mw, mh);
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[basemap fetch failed, using fallback fill]", e);
    ctx.fillStyle = "#1b1838";
    ctx.fillRect(mx, my, mw, mh);
  }

  // gradient tint over the map: navy (top) -> warm (bottom), scaled by slider.
  // `tintScale` lets a caller (the landscape layout) dial the whole tint down so
  // the actual trails/terrain read through instead of looking muddy/blotchy.
  const tintScale = options?.tintScale ?? 1;
  const strength = (0.55 + theme.tintOpacity) * tintScale; // default -> 0.8
  const tint = ctx.createLinearGradient(0, my, 0, my + mh);
  tint.addColorStop(0, `rgba(20,17,45,${Math.min(0.92, strength)})`);
  tint.addColorStop(0.55, `rgba(60,42,58,${Math.min(0.85, strength * 0.9)})`);
  tint.addColorStop(1, `rgba(150,95,45,${Math.min(0.75, strength * 0.7)})`);
  ctx.fillStyle = tint;
  ctx.fillRect(mx, my, mw, mh);

  // subtle border
  ctx.strokeStyle = "rgba(243,236,223,0.35)";
  ctx.lineWidth = mm(0.25);
  ctx.strokeRect(mx, my, mw, mh);
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  size: PosterSize,
  gpxData: GpxParseResult,
  mm: (v: number) => number,
  options?: { casing?: boolean; widthScale?: number; rotationDeg?: number }
) {
  const proj = projectRoute(size, gpxData.points, { rotationDeg: options?.rotationDeg ?? 0 });
  if (proj.points.length < 2) return;

  const { mapAreaMm } = size;
  ctx.save();
  // clip to the map box so the glow doesn't spill outside
  ctx.beginPath();
  ctx.rect(mm(mapAreaMm.x), mm(mapAreaMm.y), mm(mapAreaMm.width), mm(mapAreaMm.height));
  ctx.clip();

  const trace = () => {
    ctx.beginPath();
    proj.points.forEach((p, i) => {
      const poster = toPosterMm(p, size);
      const x = mm(poster.x);
      const y = mm(poster.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  };

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const ws = options?.widthScale ?? 1;

  if (options?.casing) {
    // Dark casing under a bright core — high contrast on a lightly-tinted map
    // (the lower tint means a plain white line would wash out).
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = mm(1.6);
    ctx.strokeStyle = "rgba(18,12,26,0.9)";
    ctx.lineWidth = mm(2.4 * ws);
    trace();
    ctx.stroke();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = mm(1.15 * ws);
    trace();
    ctx.stroke();

    ctx.restore();
    return;
  }

  // outer glow
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = mm(2.6);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = mm(1.4);
  trace();
  ctx.stroke();
  ctx.stroke();

  // solid core
  ctx.shadowBlur = mm(0.8);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = mm(0.9);
  trace();
  ctx.stroke();

  ctx.restore();
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  size: PosterSize,
  gpxData: GpxParseResult,
  markers: RouteMarker[],
  mm: (v: number) => number,
  rotationDeg = 0
) {
  const proj = projectRoute(size, gpxData.points, { rotationDeg });
  if (proj.points.length === 0) return;

  ctx.save();

  // Sort so summit/basecamp draw last (on top of pos dots).
  const order: Record<RouteMarker["type"], number> = { pos: 0, basecamp: 1, summit: 2 };
  const sorted = [...markers].sort((a, b) => order[a.type] - order[b.type]);

  for (const marker of sorted) {
    const p = proj.points[marker.trackIndex];
    if (!p) continue;
    const poster = toPosterMm(p, size);
    const x = mm(poster.x);
    const y = mm(poster.y);

    const isPos = marker.type === "pos";
    const r = isPos ? mm(1.8) : mm(2.6);
    const color = MARKER_COLORS[marker.type];

    // Dark drop shadow so the marker pops on the white route AND the map.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = mm(1.2);

    // White outer ring (border/halo)
    ctx.beginPath();
    ctx.arc(x, y, r + mm(0.7), 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    // Colored core
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Summit gets a small white center dot.
    if (marker.type === "summit") {
      ctx.beginPath();
      ctx.arc(x, y, mm(0.9), 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    // Label to the right (with a subtle dark pill for legibility).
    if (marker.label) {
      drawMarkerLabel(ctx, marker.label, x + r + mm(1.5), y, mm);
    }
  }
  ctx.restore();
}

function drawMarkerLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  xMm: number,
  yMm: number,
  mm: (v: number) => number
) {
  const fontPx = mm(3.6);
  ctx.font = `700 ${fontPx}px "Arial", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  setLetterSpacing(ctx, 0);

  const padX = mm(1.6);
  const padY = mm(1.1);
  const w = ctx.measureText(text).width + padX * 2;
  const h = fontPx + padY * 2;

  ctx.save();
  ctx.fillStyle = "rgba(12,9,22,0.72)";
  roundRect(ctx, xMm, yMm - h / 2, w, h, mm(1.2));
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#fbf5ea";
  ctx.fillText(text, xMm + padX, yMm + mm(0.15));
}

function drawRegistrationMarks(
  ctx: CanvasRenderingContext2D,
  mapAreaMm: PosterSize["mapAreaMm"],
  mm: (v: number) => number
) {
  const corners = [
    { x: mapAreaMm.x + 6, y: mapAreaMm.y + 6 },
    { x: mapAreaMm.x + mapAreaMm.width - 6, y: mapAreaMm.y + mapAreaMm.height - 6 },
  ];
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = mm(0.18);
  for (const c of corners) {
    const cx = mm(c.x);
    const cy = mm(c.y);
    const len = mm(2.6);
    ctx.beginPath();
    ctx.moveTo(cx - len, cy);
    ctx.lineTo(cx + len, cy);
    ctx.moveTo(cx, cy - len);
    ctx.lineTo(cx, cy + len);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, mm(0.9), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawElevationProfile(
  ctx: CanvasRenderingContext2D,
  gpxData: GpxParseResult,
  markers: RouteMarker[],
  xMm: number,
  yTopMm: number,
  wMm: number,
  hMm: number,
  heightMm: number,
  mm: (v: number) => number
) {
  const pts = gpxData.points;
  if (pts.length < 2) return;

  const min = gpxData.minEle;
  const max = gpxData.maxEle;
  const range = Math.max(max - min, 1);

  // cumulative distance for x axis
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + haversineMeters(pts[i - 1], pts[i]);
  const totalM = Math.max(cum[cum.length - 1], 1);

  // Layout: caption row on top, plot area below, with headroom above the peak
  // so the summit dot/label never crosses the top boundary.
  const capSize = heightMm * 0.014;
  const plotTopMm = yTopMm + capSize + heightMm * 0.016;
  const baselineMm = yTopMm + hMm;
  const topPadMm = heightMm * 0.016;
  const plotH = Math.max(baselineMm - plotTopMm - topPadMm, 1);

  const toX = (i: number) => xMm + (cum[i] / totalM) * wMm;
  const toY = (ele: number) => baselineMm - ((ele - min) / range) * plotH;

  // --- Caption row: title (left) + distance / gain (right) ---
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `${mm(capSize)}px ${MONO}`;
  setLetterSpacing(ctx, 2);
  ctx.fillStyle = GOLD;
  ctx.fillText("PROFIL ELEVASI", mm(xMm), mm(yTopMm + capSize));

  ctx.textAlign = "right";
  ctx.fillStyle = CREAM_SOFT;
  const distKm = (totalM / 1000).toFixed(1);
  ctx.fillText(`${distKm} KM  ↑ ${Math.round(gpxData.elevationGainM)} M`, mm(xMm + wMm), mm(yTopMm + capSize));
  setLetterSpacing(ctx, 0);
  ctx.textAlign = "left";

  // --- Horizontal gridlines + mdpl labels (min / mid / max) ---
  const gridSize = heightMm * 0.0115;
  ctx.font = `${mm(gridSize)}px ${MONO}`;
  ctx.lineWidth = mm(0.15);
  for (const f of [0, 0.5, 1]) {
    const ele = min + f * range;
    const gy = baselineMm - f * plotH;
    ctx.strokeStyle = CREAM_FAINT;
    ctx.setLineDash([mm(1.2), mm(1.6)]);
    ctx.beginPath();
    ctx.moveTo(mm(xMm), mm(gy));
    ctx.lineTo(mm(xMm + wMm), mm(gy));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = CREAM_SOFT;
    // All labels sit just ABOVE their gridline for consistency (the top line
    // has headroom above it for this — see topPadMm).
    ctx.textBaseline = "bottom";
    const label = f === 1 ? `${Math.round(ele)} mdpl` : `${Math.round(ele)}`;
    ctx.fillText(label, mm(xMm + 1), mm(gy - 0.6));
  }

  // --- Area fill under the curve (warm gradient, clearly visible) ---
  ctx.beginPath();
  ctx.moveTo(mm(xMm), mm(baselineMm));
  for (let i = 0; i < pts.length; i++) ctx.lineTo(mm(toX(i)), mm(toY(pts[i].ele)));
  ctx.lineTo(mm(xMm + wMm), mm(baselineMm));
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, mm(plotTopMm), 0, mm(baselineMm));
  fill.addColorStop(0, "rgba(255,196,120,0.42)");
  fill.addColorStop(1, "rgba(255,150,70,0.05)");
  ctx.fillStyle = fill;
  ctx.fill();

  // --- The ridge line (cream, glow) ---
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.65)";
  ctx.shadowBlur = mm(1.2);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = mm(toX(i));
    const y = mm(toY(pts[i].ele));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = mm(0.6);
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();

  // --- Marker positions on the profile (drop-line + colored dot) ---
  for (const m of markers) {
    const p = pts[m.trackIndex];
    if (!p) continue;
    const x = mm(toX(m.trackIndex));
    const y = mm(toY(p.ele));

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.setLineDash([mm(0.8), mm(1)]);
    ctx.lineWidth = mm(0.2);
    ctx.beginPath();
    ctx.moveTo(x, mm(baselineMm));
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = mm(0.8);
    ctx.beginPath();
    ctx.arc(x, y, mm(m.type === "pos" ? 1.0 : 1.4), 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, mm(m.type === "pos" ? 0.6 : 0.9), 0, Math.PI * 2);
    ctx.fillStyle = MARKER_COLORS[m.type];
    ctx.fill();
  }

  // baseline bar
  ctx.fillStyle = "rgba(15,12,28,0.5)";
  roundRect(ctx, mm(xMm), mm(baselineMm - 0.4), mm(wMm), mm(1.4), mm(0.7));
  ctx.fill();
}

function drawStatsRow(
  ctx: CanvasRenderingContext2D,
  size: PosterSize,
  gpxData: GpxParseResult,
  stats: SummitStats,
  mm: (v: number) => number
) {
  const { widthMm, heightMm, marginMm } = size;

  const summitEle = stats.summitElevationM || Math.round(gpxData.maxEle);
  // TANGGAL lives in the meta line now, so the stat row holds the route metrics
  // plus WAKTU + PACE when provided (parity with the landscape stat row).
  const primary: StatItem[] = [
    { label: "JARAK", value: `${stats.distanceKm.toFixed(2)} KM` },
    { label: "ELEV. GAIN", value: `+${Math.round(stats.elevationGainM)} M` },
    { label: "PUNCAK", value: `${Math.round(summitEle)} MDPL` },
  ];
  if (stats.movingTime && stats.movingTime !== "00:00:00") {
    primary.push({ label: "WAKTU", value: stats.movingTime });
  }
  if (stats.avgPace) {
    primary.push({ label: "PACE", value: stats.avgPace.toUpperCase().replace("/KM", " /KM") });
  }

  const labelSizeMm = heightMm * 0.012;
  // Bigger hero size for readability; a mild shrink when there are 5 columns
  // so long values (e.g. "02:15:00") still fit their column.
  const baseValueMm = heightMm * 0.03;
  const valueSizeMm = primary.length > 4 ? baseValueMm * 0.85 : baseValueMm;
  const valuesBaseline = heightMm - marginMm - heightMm * 0.012;
  const labelsBaseline = valuesBaseline - valueSizeMm - heightMm * 0.008;
  const dividerY = labelsBaseline - labelSizeMm - heightMm * 0.016;
  const colW = (widthMm - marginMm * 2) / primary.length;

  // Optional secondary stats (only when provided) — compact line above divider.
  const extras = computeStatsExtras(stats);

  if (extras.length > 0) {
    const exY = dividerY - heightMm * 0.014;
    const exSize = heightMm * 0.0094;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    setLetterSpacing(ctx, 0.5);
    // Start extras to the right of the QR when one is present, so SUHU/CUACA
    // never overlaps the QR box in the signature block on the left.
    const qrUpperMm = stats.qrCodeUrl ? Math.min(36, heightMm * 0.075) : 0;
    let cx = qrUpperMm > 0 ? marginMm + qrUpperMm + heightMm * 0.012 : marginMm;
    for (const e of extras) {
      ctx.font = `${mm(exSize)}px ${MONO}`;
      ctx.fillStyle = GOLD;
      ctx.fillText(e.label, mm(cx), mm(exY));
      cx += measureMm(ctx, e.label, mm) + 1.5;

      const val = e.value.toUpperCase();
      ctx.font = `600 ${mm(exSize)}px "Arial", sans-serif`;
      ctx.fillStyle = CREAM_SOFT;
      ctx.fillText(val, mm(cx), mm(exY));
      cx += measureMm(ctx, val, mm) + 5;
    }
    setLetterSpacing(ctx, 0);
  }

  // Divider line above the stats.
  ctx.strokeStyle = CREAM_FAINT;
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.moveTo(mm(marginMm), mm(dividerY));
  ctx.lineTo(mm(widthMm - marginMm), mm(dividerY));
  ctx.stroke();

  primary.forEach((s, i) => {
    const cx = marginMm + colW * i;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.font = `${mm(labelSizeMm)}px ${MONO}`;
    ctx.fillStyle = GOLD;
    setLetterSpacing(ctx, 1.5);
    ctx.fillText(s.label, mm(cx), mm(labelsBaseline));
    setLetterSpacing(ctx, 0);

    ctx.font = `700 ${mm(valueSizeMm)}px ${SANS}`;
    setTextShadow(ctx, mm(1), mm(0.3), 0.5);
    ctx.fillStyle = CREAM;
    ctx.fillText(s.value, mm(cx), mm(valuesBaseline));
    clearShadow(ctx);
  });
}

/** Text width in mm for the current ctx font (mm(1) === pixels per mm). */
function measureMm(ctx: CanvasRenderingContext2D, text: string, mm: (v: number) => number): number {
  return ctx.measureText(text).width / mm(1);
}

/** Photos fill the right column (big, framed, side-by-side), each honoring its
 *  own pan/zoom transform. Frame positions come from the shared helper. */
async function drawPhotos(
  ctx: CanvasRenderingContext2D,
  photos: { src: string; tf: PhotoTransform }[],
  size: PosterSize,
  stats: SummitStats,
  mm: (v: number) => number
) {
  const frames = computePhotoFrames(size, stats, photos.length);
  if (frames[0].hMm < 8) return;
  for (let i = 0; i < photos.length; i++) {
    const f = frames[i];
    if (!f) break;
    await drawRoundedImage(ctx, photos[i].src, f.xMm, f.yMm, f.wMm, f.hMm, mm, photos[i].tf, true);
  }
}

/**
 * Signature block: the QR code with the climber name and social handles
 * stacked to its right. Anchored `topMm` mm below the subtitle for a clear,
 * consistent gap, and clamped so it never crowds the stats block below
 * (`maxBottomMm`) — shrinking the QR if the available space is tight.
 */
async function drawSignature(
  ctx: CanvasRenderingContext2D,
  stats: SummitStats,
  leftXMm: number,
  topMm: number,
  maxBottomMm: number,
  heightMm: number,
  mm: (v: number) => number,
  maxRightMm?: number
) {
  const hasQr = !!stats.qrCodeUrl;
  const socials: string[] = [];
  if (stats.instagram) socials.push(`IG ${stats.instagram.startsWith("@") ? stats.instagram : "@" + stats.instagram}`);
  if (stats.tiktok) socials.push(`TT ${stats.tiktok.startsWith("@") ? stats.tiktok : "@" + stats.tiktok}`);
  const weatherBits: string[] = [];
  if (stats.temperature) weatherBits.push(`SUHU ${stats.temperature.toUpperCase()}`);
  if (stats.weather) weatherBits.push(`CUACA ${stats.weather.toUpperCase()}`);
  const hasText = !!stats.climberName || socials.length > 0 || weatherBits.length > 0;
  if (!hasQr && !hasText) return;

  // Shrink the QR to whatever room is actually available, down to a hard
  // floor — and always clamp its top position so it can never be drawn past
  // maxBottomMm, even when the desired size doesn't fit. This is what
  // prevents the signature block from bleeding into the stats row below.
  const availableH = Math.max(maxBottomMm - topMm, 0);
  // A larger, more prominent QR: caps raised so it can grow when there's room.
  const qrSize = Math.max(14, Math.min(36, heightMm * 0.075, availableH));
  const qy = Math.min(topMm, maxBottomMm - qrSize);
  let textX = leftXMm;

  if (hasQr) {
    const qrUrl = await generateQrDataUrl(stats.qrCodeUrl!, 380);
    if (qrUrl) {
      try {
        const img = await loadImageFromUrl(qrUrl);
        const pad = qrSize * 0.08;
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, mm(leftXMm), mm(qy), mm(qrSize), mm(qrSize), mm(1.4));
        ctx.fill();
        ctx.drawImage(img, mm(leftXMm + pad), mm(qy + pad), mm(qrSize - pad * 2), mm(qrSize - pad * 2));
        textX = leftXMm + qrSize + heightMm * 0.012;
      } catch {
        /* ignore */
      }
    }
  }

  if (hasText) {
    ctx.textAlign = "left";
    setTextShadow(ctx, mm(0.9), mm(0.3), 0.45);

    let nameSize = Math.min(heightMm * 0.022, qrSize * 0.26);
    let socialSize = Math.min(heightMm * 0.016, qrSize * 0.2);
    let weatherSize = Math.min(heightMm * 0.014, qrSize * 0.17);

    // Shrink text sizes proportionally until each row fits the available width
    // (so long handles or weather text never overflow into the photo).
    if (maxRightMm !== undefined) {
      const availMm = Math.max(maxRightMm - textX, 20);
      const measure = (text: string, sizeMm: number, font: string) => {
        ctx.font = `${font} ${mm(sizeMm)}px "Arial", sans-serif`;
        return measureMm(ctx, text, mm);
      };
      const nameW = stats.climberName ? measure(stats.climberName, nameSize, "700") : 0;
      // Socials are stacked one per line, so the widest single handle governs.
      const socW = socials.reduce((mx, s) => Math.max(mx, measure(s, socialSize, "600")), 0);
      const weaW = weatherBits.length > 0 ? measure(weatherBits.join("   ·   "), weatherSize, "600") : 0;
      const worstRatio = Math.max(nameW / availMm, socW / availMm, weaW / availMm, 1);
      if (worstRatio > 1) {
        nameSize /= worstRatio;
        socialSize /= worstRatio;
        weatherSize /= worstRatio;
      }
    }
    const lineGap = nameSize * 0.28;
    // Stack (all centered vertically against the QR box):
    //   Name              ← bold hero
    //   IG @handle        ← one handle per line
    //   TT @handle
    //   SUHU 18°C · CUACA CERAH  ← weather caption
    type Row = { size: number } & (
      | { kind: "name" }
      | { kind: "social"; text: string }
      | { kind: "weather" }
    );
    const rows: Row[] = [];
    if (stats.climberName) rows.push({ size: nameSize, kind: "name" });
    for (const s of socials) rows.push({ size: socialSize, kind: "social", text: s });
    if (weatherBits.length > 0) rows.push({ size: weatherSize, kind: "weather" });
    const textBlockH = rows.reduce((s, r, i) => s + r.size + (i > 0 ? lineGap : 0), 0);
    const textTop = qy + (qrSize - textBlockH) / 2;

    ctx.textBaseline = "top";
    let ty = textTop;
    rows.forEach((r, i) => {
      if (i > 0) ty += lineGap;
      if (r.kind === "name") {
        ctx.font = `700 ${mm(r.size)}px "Arial", sans-serif`;
        ctx.fillStyle = CREAM;
        ctx.fillText(stats.climberName, mm(textX), mm(ty));
      } else if (r.kind === "social") {
        ctx.font = `600 ${mm(r.size)}px "Arial", sans-serif`;
        ctx.fillStyle = CREAM_SOFT;
        ctx.fillText(r.text, mm(textX), mm(ty));
      } else {
        // Weather: label + value share the SAME font & size (Arial), so "SUHU"
        // reads as big as "18°C". Label gold, value cream, middot between groups.
        let wx = textX;
        weatherBits.forEach((b, j) => {
          if (j > 0) {
            ctx.font = `${mm(r.size)}px "Arial", sans-serif`;
            ctx.fillStyle = CREAM_MUTED;
            ctx.fillText("·", mm(wx), mm(ty));
            wx += measureMm(ctx, "·", mm) + heightMm * 0.01;
          }
          const [label, ...rest] = b.split(" ");
          const value = rest.join(" ");
          ctx.font = `700 ${mm(r.size)}px "Arial", sans-serif`;
          ctx.fillStyle = GOLD;
          ctx.fillText(label, mm(wx), mm(ty));
          wx += measureMm(ctx, label, mm) + heightMm * 0.006;
          ctx.font = `600 ${mm(r.size)}px "Arial", sans-serif`;
          ctx.fillStyle = CREAM;
          ctx.fillText(value, mm(wx), mm(ty));
          wx += measureMm(ctx, value, mm) + heightMm * 0.012;
        });
      }
      ty += r.size;
    });
    clearShadow(ctx);
  }
}

async function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  src: string,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  mm: (v: number) => number,
  transform: PhotoTransform = DEFAULT_PHOTO_TRANSFORM,
  withBorder = false
) {
  try {
    const img = await loadImageFromUrl(src);
    const fx = mm(xMm);
    const fy = mm(yMm);
    const fw = mm(wMm);
    const fh = mm(hMm);

    ctx.save();
    roundRect(ctx, fx, fy, fw, fh, mm(1.5));
    ctx.clip();

    // Same crop math the on-screen cropper uses → WYSIWYG.
    const rect = computeImageRect(fw, fh, img.width, img.height, transform);
    ctx.drawImage(img, fx + rect.dx, fy + rect.dy, rect.dw, rect.dh);
    ctx.restore();

    if (withBorder) {
      ctx.strokeStyle = "rgba(243,236,223,0.6)";
      ctx.lineWidth = mm(0.3);
      roundRect(ctx, fx, fy, fw, fh, mm(1.5));
      ctx.stroke();
    }
  } catch {
    /* skip missing/broken photo */
  }
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}
