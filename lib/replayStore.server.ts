import { promises as fs } from "fs";
import path from "path";
import { parseReplayData, type ReplayData } from "@/lib/replay";

/* ============================================================================
 * Penyimpanan data Summit Replay sisi SERVER, per-id. Urutan deteksi:
 *   1. Netlify Blobs  — bila env NETLIFY atau NETLIFY_BLOBS_CONTEXT tersedia.
 *   2. Vercel Blob    — bila env VERCEL=1 dan BLOB_READ_WRITE_TOKEN tersedia.
 *   3. File lokal     — fallback development (.data/replays/<id>.json).
 * Beda dengan pricing: tidak ada default — id tak dikenal = null (404).
 * ========================================================================== */

const BLOB_STORE = "replays";
const DEV_DIR = path.join(process.cwd(), ".data", "replays");

/** Id valid = 10 hex — sekaligus mencegah path traversal di fallback file. */
const ID_RE = /^[a-f0-9]{10}$/;

/* ----------------------------- Netlify Blobs ----------------------------- */

async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs");
  // Melempar di luar lingkungan Netlify — ditangkap pemanggil.
  return getStore(BLOB_STORE);
}

/* ------------------------------ Vercel Blob ------------------------------ */

/** Kunci objek Vercel Blob untuk id replay tertentu. */
const vercelKey = (id: string) => `replays/${id}.json`;

async function readVercelBlob(id: string): Promise<ReplayData | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const { head } = await import("@vercel/blob");
    // head() cepat untuk mengecek keberadaan objek sebelum fetch isi.
    const meta = await head(vercelKey(id), { token }).catch(() => null);
    if (!meta) return null;
    const res = await fetch(meta.url);
    if (!res.ok) return null;
    const raw = (await res.json()) as unknown;
    return parseReplayData(raw);
  } catch {
    return null;
  }
}

async function writeVercelBlob(id: string, data: ReplayData): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN tidak tersedia.");
  const { put } = await import("@vercel/blob");
  await put(vercelKey(id), JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    token,
  });
}

/* ----------------------------- public API -------------------------------- */

export async function readReplay(id: string): Promise<ReplayData | null> {
  if (!ID_RE.test(id)) return null;

  // 1. Netlify Blobs (production Netlify).
  try {
    const store = await netlifyStore();
    const raw = (await store.get(id, { type: "json" })) as unknown;
    const parsed = parseReplayData(raw);
    if (parsed) return parsed;
  } catch {
    /* bukan di Netlify — coba Vercel */
  }

  // 2. Vercel Blob (production Vercel).
  if (process.env.VERCEL) {
    const parsed = await readVercelBlob(id);
    if (parsed) return parsed;
  }

  // 3. File lokal (development).
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

  // 1. Netlify Blobs (production Netlify).
  try {
    const store = await netlifyStore();
    await store.setJSON(id, data);
    return;
  } catch {
    /* bukan di Netlify */
  }

  // 2. Vercel Blob (production Vercel).
  if (process.env.VERCEL) {
    await writeVercelBlob(id, data);
    return;
  }

  // 3. File lokal (development).
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.writeFile(path.join(DEV_DIR, `${id}.json`), JSON.stringify(data), "utf8");
}

