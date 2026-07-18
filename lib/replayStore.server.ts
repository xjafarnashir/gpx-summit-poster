import { promises as fs } from "fs";
import path from "path";
import { parseReplayData, type ReplayData } from "@/lib/replay";

/* ============================================================================
 * Penyimpanan data Summit Replay sisi SERVER, per-id. Pola sama dengan
 * lib/pricingStore.server.ts:
 *   - Production (Netlify): Netlify Blobs, store "replays", key = id.
 *   - Development: fallback file .data/replays/<id>.json (di-gitignore).
 * Beda dengan pricing: tidak ada default — id tak dikenal = null (404).
 * ========================================================================== */

const BLOB_STORE = "replays";
const DEV_DIR = path.join(process.cwd(), ".data", "replays");

/** Id valid = 10 hex — sekaligus mencegah path traversal di fallback file. */
const ID_RE = /^[a-f0-9]{10}$/;

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  // Melempar di luar lingkungan Netlify (mis. next dev) — ditangkap pemanggil.
  return getStore(BLOB_STORE);
}

export async function readReplay(id: string): Promise<ReplayData | null> {
  if (!ID_RE.test(id)) return null;

  // 1. Netlify Blobs (production).
  try {
    const store = await blobStore();
    const raw = (await store.get(id, { type: "json" })) as unknown;
    const parsed = parseReplayData(raw);
    if (parsed) return parsed;
  } catch {
    /* bukan di Netlify — coba file lokal */
  }

  // 2. File lokal (development).
  try {
    const raw = JSON.parse(await fs.readFile(path.join(DEV_DIR, `${id}.json`), "utf8")) as unknown;
    const parsed = parseReplayData(raw);
    if (parsed) return parsed;
  } catch {
    /* tidak ada */
  }

  return null;
}

export async function writeReplay(id: string, data: ReplayData): Promise<void> {
  if (!ID_RE.test(id)) throw new Error("Id replay tidak valid.");

  // 1. Netlify Blobs (production).
  try {
    const store = await blobStore();
    await store.setJSON(id, data);
    return;
  } catch {
    /* bukan di Netlify — tulis file lokal */
  }

  // 2. File lokal (development).
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.writeFile(path.join(DEV_DIR, `${id}.json`), JSON.stringify(data), "utf8");
}
