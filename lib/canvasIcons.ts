import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { LucideIcon } from "lucide-react";

const cache = new Map<string, HTMLImageElement>();

/** Renders a Lucide icon to an <img> (via inline SVG data URL), cached by key. */
export function getIconImage(Icon: LucideIcon, color: string, size = 64): Promise<HTMLImageElement> {
  const key = `${Icon.displayName ?? Icon.name}-${color}-${size}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  const svg = renderToStaticMarkup(createElement(Icon, { color, size, strokeWidth: 2 }));
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cache.set(key, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error("Gagal render icon."));
    img.src = dataUrl;
  });
}
