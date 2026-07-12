/**
 * Re-encodes an image file to a high-quality JPEG data URL, only downscaling
 * if it's larger than `maxDimPx` on the longer side. Kept high (near-lossless
 * quality, large cap) so exported poster PNGs stay print-sharp — the
 * QuotaExceededError safety net in lib/store.ts (safeStorage) is what keeps
 * the app from crashing if this ever doesn't fit in localStorage, so we don't
 * need to sacrifice photo quality up front just to guarantee persistence.
 */
export async function compressImageToDataUrl(
  file: File,
  maxDimPx = 3200,
  quality = 0.96
): Promise<string> {
  const bitmap = await loadBitmap(file);
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimPx / Math.max(width, height));
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context tidak tersedia.");
    ctx.drawImage(bitmap, 0, 0, outW, outH);

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close?.();
  }
}

function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  // Fallback for browsers without createImageBitmap: draw via <img>.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img as unknown as ImageBitmap);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar."));
    };
    img.src = url;
  });
}
