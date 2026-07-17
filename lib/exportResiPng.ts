import type { ShippingInfo } from "@/types";
import { WA_NUMBER, packageById, type PackageId } from "@/lib/landing";

/* ============================================================================
 * Resi pengiriman sebagai PNG kanvas 10x15 cm (ukuran label thermal umum),
 * ikut dibundel di "Export Full" bersama poster/STL/SVG. Tata letaknya sama
 * dengan resi yang dicetak lewat tombol Print Resi, tapi dirender ke kanvas
 * supaya bisa disimpan/di-share sebagai gambar.
 * ========================================================================== */

export const RESI_WIDTH_MM = 100;
export const RESI_HEIGHT_MM = 150;
const RESI_DPI = 300;

/**
 * Rincian isi poster untuk resi — diambil dari data editor yang sedang
 * dikerjakan (bukan dari payload pesanan), supaya selalu cocok dengan poster
 * yang benar-benar dikirim meski nama sempat dikoreksi admin.
 */
export interface ResiDetail {
  pendaki?: string;
  gunung?: string[];
}

/** Nomor WA admin dalam format lokal (0…) — sama dengan footer landing page. */
export const ADMIN_WA_LOCAL = WA_NUMBER.replace(/^62/, "0");

/**
 * Daftar gunung untuk baris "Gunung: …". Nama di editor lazimnya sudah memuat
 * kata "Gunung" (mis. "Gunung Sindoro"), yang jadi dobel dengan labelnya dan
 * bikin barisnya melipat — jadi prefiks itu dibuang di resi.
 */
export function formatGunungList(names: string[]): string {
  return names
    .map((g) => g.trim().replace(/^gunung\s+/i, ""))
    .filter(Boolean)
    .join(" · ");
}

const INK = "#1a1a1a";
const MUTED = "#6b6b6b";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Pecah teks jadi baris yang muat `maxWidth` (px), memotong kata super panjang. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Render resi ke kanvas 100x150 mm @300 DPI. Memuat penerima, no HP, alamat,
 * isi paket, serta identitas pengirim (myKoordinat + WA admin).
 */
export function renderResiCanvas(shipping: ShippingInfo, detail?: ResiDetail): HTMLCanvasElement {
  const pxPerMm = RESI_DPI / 25.4;
  const mm = (v: number) => v * pxPerMm;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mm(RESI_WIDTH_MM));
  canvas.height = Math.round(mm(RESI_HEIGHT_MM));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context tidak tersedia.");

  const font = (sizeMm: number, weight = "400") => `${weight} ${mm(sizeMm)}px system-ui, -apple-system, sans-serif`;

  // Kertas putih + bingkai.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const margin = 5;
  const fx = mm(margin);
  const fy = mm(margin);
  const fw = mm(RESI_WIDTH_MM - margin * 2);
  const fh = mm(RESI_HEIGHT_MM - margin * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = mm(0.5);
  roundRect(ctx, fx, fy, fw, fh, mm(2));
  ctx.stroke();

  const padX = mm(margin + 4);
  const contentW = mm(RESI_WIDTH_MM - (margin + 4) * 2);
  let y = mm(margin + 9);

  // --- Header brand: pengirim + judul resi ---
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.font = font(5.4, "800");
  ctx.textAlign = "left";
  ctx.fillText("myKoordinat", padX, y);

  ctx.font = font(2.6, "600");
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText("RESI PENGIRIMAN", padX + contentW, y);

  y += mm(2.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = mm(0.5);
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(padX + contentW, y);
  ctx.stroke();

  ctx.textAlign = "left";

  // --- Penerima ---
  y += mm(6);
  ctx.font = font(2.5, "700");
  ctx.fillStyle = MUTED;
  ctx.fillText("PENERIMA", padX, y);

  y += mm(6);
  ctx.font = font(6, "800");
  ctx.fillStyle = INK;
  for (const line of wrapLines(ctx, shipping.penerima || "-", contentW)) {
    ctx.fillText(line, padX, y);
    y += mm(6.6);
  }

  y += mm(0.5);
  ctx.font = font(4.2, "700");
  ctx.fillText(shipping.hp || "-", padX, y);

  y += mm(6);
  ctx.font = font(3.6, "400");
  ctx.fillStyle = INK;
  for (const line of wrapLines(ctx, shipping.alamat || "-", contentW)) {
    ctx.fillText(line, padX, y);
    y += mm(4.6);
  }

  // --- Isi paket ---
  y += mm(4);
  ctx.font = font(2.5, "700");
  ctx.fillStyle = MUTED;
  ctx.fillText("ISI PAKET", padX, y);

  y += mm(4.6);
  ctx.font = font(3.4, "500");
  ctx.fillStyle = INK;
  const pkg = shipping.paket ? packageById(shipping.paket as PackageId) : null;
  const isi = pkg ? `${shipping.ringkasan} — ${pkg.name} (${pkg.mount})` : shipping.ringkasan;
  for (const line of wrapLines(ctx, isi || "-", contentW)) {
    ctx.fillText(line, padX, y);
    y += mm(4.4);
  }

  // Rincian isi poster: nama pendaki + gunung di dalamnya.
  const gunung = formatGunungList(detail?.gunung ?? []);
  const rincian = [
    detail?.pendaki?.trim() ? `Pendaki: ${detail.pendaki.trim()}` : null,
    gunung ? `Gunung: ${gunung}` : null,
  ].filter((v): v is string => v !== null);

  if (rincian.length) {
    y += mm(1.2);
    ctx.font = font(3.2, "600");
    for (const text of rincian) {
      for (const line of wrapLines(ctx, text, contentW)) {
        ctx.fillText(line, padX, y);
        y += mm(4.2);
      }
    }
  }

  // --- Pengirim (nama + WA admin) ---
  y += mm(4);
  ctx.font = font(2.5, "700");
  ctx.fillStyle = MUTED;
  ctx.fillText("PENGIRIM", padX, y);

  y += mm(4.8);
  ctx.font = font(3.8, "700");
  ctx.fillStyle = INK;
  ctx.fillText("myKoordinat", padX, y);

  y += mm(4.6);
  ctx.font = font(3.4, "500");
  ctx.fillText(`WA ${ADMIN_WA_LOCAL}`, padX, y);

  // --- Footer: catatan + tanggal cetak (ditempel di dasar bingkai) ---
  const footY = fy + fh - mm(7);
  ctx.strokeStyle = "#999999";
  ctx.lineWidth = mm(0.25);
  ctx.setLineDash([mm(1), mm(1)]);
  ctx.beginPath();
  ctx.moveTo(padX, footY - mm(4));
  ctx.lineTo(padX + contentW, footY - mm(4));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = font(2.6, "500");
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.fillText("Fragile: jangan ditekuk / ditindih", padX, footY);

  const now = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  ctx.textAlign = "right";
  ctx.fillText(`Dicetak ${now}`, padX + contentW, footY);

  return canvas;
}
