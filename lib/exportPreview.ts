/* ============================================================================
 * Watermark untuk PNG PREVIEW yang dikirim ke customer sebelum bayar.
 * Teks "myKoordinat · PREVIEW" ditabur diagonal memenuhi kanvas sehingga tidak
 * bisa di-crop hilang, tapi cukup transparan supaya customer tetap bisa menilai
 * desain posternya. Export PNG / Export Full TIDAK tersentuh (tetap bersih).
 * ========================================================================== */

/** Resolusi preview: cukup tajam di layar HP, tidak layak cetak besar. */
export const PREVIEW_DPI = 150;

export const WATERMARK_TEXT = "myKoordinat · PREVIEW";

/** Gambar watermark diagonal berulang di atas kanvas poster (in-place). */
export function applyPreviewWatermark(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const fontPx = Math.max(22, Math.round(Math.min(w, h) * 0.045));

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6); // miring 30° — susah dihapus/crop
  ctx.font = `700 ${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Dua lapis (isi terang + garis gelap tipis) supaya kebaca di area terang
  // MAUPUN gelap poster, tanpa menutupi desain.
  ctx.fillStyle = "rgba(255, 255, 255, 0.17)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
  ctx.lineWidth = Math.max(1, fontPx * 0.05);

  const stepX = ctx.measureText(WATERMARK_TEXT).width + fontPx * 3;
  const stepY = fontPx * 3.4;
  const half = Math.hypot(w, h) / 2 + stepX; // tutupi sampai sudut saat dirotasi

  let row = 0;
  for (let y = -half; y <= half; y += stepY, row++) {
    const offset = (row % 2) * (stepX / 2); // selang-seling seperti bata
    for (let x = -half; x <= half; x += stepX) {
      ctx.strokeText(WATERMARK_TEXT, x + offset, y);
      ctx.fillText(WATERMARK_TEXT, x + offset, y);
    }
  }

  ctx.restore();
}
