/* Ikon hiker custom (orang condong + ransel + tongkat), MENGHADAP KIRI.
 * Silhouette terisi supaya kebaca di ukuran kecil. Dipakai poster koleksi
 * (nama pendaki di blok ekspedisi) dan poster single (baris nama pendaki). */

const cache = new Map<string, HTMLImageElement>();

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal render ikon hiker."));
    img.src = url;
  });
}

export function hikerIconImage(color: string, size = 64): Promise<HTMLImageElement> {
  const key = `${color}-${size}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  // `translate(24,0) scale(-1,1)` mencerminkan horizontal → hiker menghadap KIRI.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">` +
    `<g transform="translate(24,0) scale(-1,1)">` +
    `<g fill="${color}">` +
    `<circle cx="11.4" cy="3.9" r="2.05"/>` +
    `<rect x="6.4" y="6.2" width="3.9" height="5.9" rx="1.7" transform="rotate(9 8.35 9.15)"/>` +
    `<rect x="9.5" y="5.8" width="3.2" height="7.1" rx="1.6" transform="rotate(11 11.1 9.35)"/>` +
    `<rect x="8.2" y="12.0" width="2.3" height="6.6" rx="1.15" transform="rotate(24 9.35 15.3)"/>` +
    `<rect x="11.3" y="12.2" width="2.3" height="6.9" rx="1.15" transform="rotate(-13 12.45 15.65)"/>` +
    `<rect x="10.7" y="6.5" width="4.9" height="2.0" rx="1.0" transform="rotate(24 13.15 7.5)"/>` +
    `</g>` +
    `<line x1="15.6" y1="8.7" x2="17.8" y2="20.6" stroke="${color}" stroke-width="1.25" stroke-linecap="round"/>` +
    `</g>` +
    `</svg>`;
  return loadImageFromUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`).then((img) => {
    cache.set(key, img);
    return img;
  });
}
