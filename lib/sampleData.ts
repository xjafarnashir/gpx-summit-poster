import type { SummitStats } from "@/types";
import { computeAvgPace, secondsToHms } from "./statFormat";
import { DEFAULT_PHOTO_TRANSFORM } from "./photoTransform";

/** Generates a nice gradient placeholder photo (mountain silhouette) as a JPEG data URL. */
function genPlaceholderPhoto(label: string, c1: string, c2: string): string {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 520;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const g = ctx.createLinearGradient(0, 0, 0, 520);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 400, 520);

  // layered mountain silhouettes
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.lineTo(90, 330);
  ctx.lineTo(190, 410);
  ctx.lineTo(280, 300);
  ctx.lineTo(400, 440);
  ctx.lineTo(400, 520);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.lineTo(140, 380);
  ctx.lineTo(250, 440);
  ctx.lineTo(360, 360);
  ctx.lineTo(400, 400);
  ctx.lineTo(400, 520);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, 200, 250);
  ctx.font = "13px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("FOTO CONTOH", 200, 280);

  return c.toDataURL("image/jpeg", 0.85);
}

export interface SamplePosMarker {
  label: string;
  fraction: number; // position along the track (0..1)
}

export const SAMPLE_POS_MARKERS: SamplePosMarker[] = [
  { label: "Pos 1 — Sikut Dewo", fraction: 0.3 },
  { label: "Pos 2 — Cacingan", fraction: 0.55 },
  { label: "Pos 3 — Plawangan", fraction: 0.8 },
];

/** All-fields dummy data for previewing the full poster. */
export function buildSampleStats(distanceKm: number): Partial<SummitStats> {
  // Derive a realistic hiking moving time (~24 min/km uphill) from the actual
  // track distance, so the sample pace never looks absurd on short test tracks.
  const km = distanceKm > 0 ? distanceKm : 8;
  const movingTime = secondsToHms(Math.round(km * 24 * 60));
  return {
    movingTime,
    avgPace: computeAvgPace(distanceKm, movingTime),
    temperature: "12°C",
    weather: "Cerah Berkabut",
    headerLabel: "RUTE PENDAKIAN",
    climberName: "Lokman Nashiruddin",
    mountainName: "Gunung Prau",
    date: "2 Juli 2026",
    viaRoute: "Via Patak Banteng",
    instagram: "@lokman.hike",
    tiktok: "@lokman",
    qrCodeUrl: "https://www.strava.com/activities/1234567890",
    summitPhoto: genPlaceholderPhoto("SUMMIT", "#38bdf8", "#1e3a8a"),
    landscapePhoto: genPlaceholderPhoto("LANDSCAPE", "#fbbf24", "#7c2d12"),
    summitPhotoTransform: DEFAULT_PHOTO_TRANSFORM,
    landscapePhotoTransform: DEFAULT_PHOTO_TRANSFORM,
  };
}
