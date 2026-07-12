"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Plus, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { CARTO_STYLE_URL } from "@/lib/tileFetcher";
import { snapToNearestTrackIndex } from "@/lib/geo";
import { buildMarkerElement } from "@/lib/mapIcons";
import type { RouteMarker } from "@/types";

const ROUTE_SOURCE_ID = "route-source";
const ROUTE_LAYER_ID = "route-line-layer";

export default function MapEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [addPosMode, setAddPosMode] = useState(false);

  const gpxData = useAppStore((s) => s.gpxData);
  const markers = useAppStore((s) => s.markers);
  const theme = useAppStore((s) => s.theme.theme);
  const addMarker = useAppStore((s) => s.addMarker);
  const updateMarker = useAppStore((s) => s.updateMarker);

  // Initialize the map once GPX data is available.
  useEffect(() => {
    if (!containerRef.current || !gpxData || mapRef.current) return;

    const centerLon = (gpxData.bbox.minLon + gpxData.bbox.maxLon) / 2;
    const centerLat = (gpxData.bbox.minLat + gpxData.bbox.maxLat) / 2;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_STYLE_URL[theme],
      center: [centerLon, centerLat],
      zoom: 12,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const setupRouteLayer = () => {
      if (map.getSource(ROUTE_SOURCE_ID)) return;
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: gpxData.points.map((p) => [p.lon, p.lat]),
          },
        },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#dc2626", "line-width": 4, "line-opacity": 0.9 },
      });
    };

    map.on("load", () => {
      setupRouteLayer();
      const bounds = new maplibregl.LngLatBounds();
      gpxData.points.forEach((p) => bounds.extend([p.lon, p.lat]));
      map.fitBounds(bounds, { padding: 50, duration: 0 });
      setMapReady(true);
    });

    // Style changes (theme switch) wipe custom sources/layers — re-add them.
    map.on("style.load", setupRouteLayer);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpxData !== null]);

  // Theme switch.
  useEffect(() => {
    if (mapRef.current && mapReady) {
      mapRef.current.setStyle(CARTO_STYLE_URL[theme]);
    }
  }, [theme, mapReady]);

  // Add-pos-mode: click on map snaps to nearest track point and adds a Pos marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !addPosMode || !gpxData) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const idx = snapToNearestTrackIndex(gpxData.points, { lat: e.lngLat.lat, lon: e.lngLat.lng });
      const posCount = markers.filter((m) => m.type === "pos").length;
      const marker: RouteMarker = {
        id: crypto.randomUUID(),
        type: "pos",
        label: `Pos ${posCount + 1}`,
        trackIndex: idx,
        order: posCount,
      };
      addMarker(marker);
      setAddPosMode(false);
    };

    map.on("click", handleClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", handleClick);
      map.getCanvas().style.cursor = "";
    };
  }, [addPosMode, gpxData, markers, addMarker]);

  // Sync store markers -> MapLibre marker DOM elements.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gpxData || !mapReady) return;

    const currentIds = new Set(markers.map((m) => m.id));
    markerRefs.current.forEach((mlMarker, id) => {
      if (!currentIds.has(id)) {
        mlMarker.remove();
        markerRefs.current.delete(id);
      }
    });

    markers.forEach((m) => {
      const pt = gpxData.points[m.trackIndex];
      if (!pt) return;

      let mlMarker = markerRefs.current.get(m.id);
      if (!mlMarker) {
        const el = buildMarkerElement(m.type);
        mlMarker = new maplibregl.Marker({ element: el, draggable: true, anchor: "center" })
          .setLngLat([pt.lon, pt.lat])
          .addTo(map);

        mlMarker.on("dragend", () => {
          const lngLat = mlMarker!.getLngLat();
          const idx = snapToNearestTrackIndex(gpxData.points, { lat: lngLat.lat, lon: lngLat.lng });
          const snapped = gpxData.points[idx];
          mlMarker!.setLngLat([snapped.lon, snapped.lat]);
          updateMarker(m.id, { trackIndex: idx });
        });

        markerRefs.current.set(m.id, mlMarker);
      } else {
        mlMarker.setLngLat([pt.lon, pt.lat]);
      }
    });
  }, [markers, gpxData, mapReady, updateMarker]);

  if (!gpxData) return null;

  return (
    <div className="clay-card relative shrink-0 overflow-hidden !rounded-[1.75rem]">
      <div ref={containerRef} className="h-[420px] w-full sm:h-[520px]" />

      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setAddPosMode((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold shadow-md transition-colors ${
            addPosMode
              ? "bg-[#d97757] text-white"
              : "bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200"
          }`}
        >
          {addPosMode ? <X size={14} /> : <Plus size={14} />}
          {addPosMode ? "Klik peta untuk tambah Pos" : "Tambah Pos"}
        </button>
      </div>

      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-zinc-600 shadow-md dark:bg-zinc-800/90 dark:text-zinc-300">
        <MapPin size={12} />
        Drag marker untuk pindah posisi — otomatis nempel ke jalur
      </div>
    </div>
  );
}
