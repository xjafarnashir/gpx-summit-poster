/** Parses "HH:MM:SS" (or "H:MM:SS") into total seconds. Returns 0 if invalid. */
export function parseHmsToSeconds(hms: string): number {
  const parts = hms.split(":").map((p) => Number(p.trim()));
  if (parts.some((p) => Number.isNaN(p))) return 0;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  return 0;
}

export function secondsToHms(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Computes pace as "MM:SS/km" from distance (km) and moving time ("HH:MM:SS"). */
export function computeAvgPace(distanceKm: number, movingTime: string): string {
  const totalSeconds = parseHmsToSeconds(movingTime);
  if (distanceKm <= 0 || totalSeconds <= 0) return "";
  const secPerKm = totalSeconds / distanceKm;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, "0")}/km`;
}
