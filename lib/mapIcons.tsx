import { renderToStaticMarkup } from "react-dom/server";
import { Flag, Mountain, Tent } from "lucide-react";
import type { MarkerType } from "@/types";

export const MARKER_COLORS: Record<MarkerType, string> = {
  basecamp: "#0ea5e9",
  pos: "#f59e0b",
  summit: "#ef4444",
};

export function markerIconSvg(type: MarkerType): string {
  if (type === "basecamp") return renderToStaticMarkup(<Tent color="white" size={16} strokeWidth={2.5} />);
  if (type === "summit") return renderToStaticMarkup(<Mountain color="white" size={16} strokeWidth={2.5} />);
  return renderToStaticMarkup(<Flag color="white" size={14} strokeWidth={2.5} />);
}

export function buildMarkerElement(type: MarkerType): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.borderRadius = "50%";
  el.style.background = MARKER_COLORS[type];
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "grab";
  el.innerHTML = markerIconSvg(type);
  return el;
}
