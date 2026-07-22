import { promises as fs } from "fs";
import path from "path";
import { parseReplayData, replayTitle, type ReplayData, type ReplayListItem } from "@/lib/replay";

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
    const { list } = await import("@vercel/blob");
    // Karena head() butuh URL lengkap, gunakan list() dengan prefix path untuk mencari file
    const response = await list({ prefix: vercelKey(id), token });
    const blob = response.blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.url);
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

  // 2. Vercel Blob (bila token tersedia).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
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

  // Simpan bersama createdAt agar daftar dashboard punya tanggal. parseReplayData
  // mengabaikan field ekstra ini, jadi readReplay tetap aman.
  const stored = { ...data, createdAt: Date.now() } as ReplayData & { createdAt: number };

  // 1. Netlify Blobs (production Netlify).
  try {
    const store = await netlifyStore();
    await store.setJSON(id, stored);
    return;
  } catch {
    /* bukan di Netlify */
  }

  // 2. Vercel Blob (bila token tersedia).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await writeVercelBlob(id, stored);
    return;
  }

  // 3. File lokal (development).
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.writeFile(path.join(DEV_DIR, `${id}.json`), JSON.stringify(stored), "utf8");
}

/* ------------------------ daftar & hapus (admin) ------------------------- */

function toListItem(id: string, raw: unknown, fallbackDate: number | null): ReplayListItem | null {
  const data = parseReplayData(raw);
  if (!data) return null;
  const createdAt =
    typeof (raw as { createdAt?: unknown })?.createdAt === "number"
      ? (raw as { createdAt: number }).createdAt
      : fallbackDate;
  return { id, kind: data.kind, title: replayTitle(data), createdAt };
}

export async function listReplays(): Promise<ReplayListItem[]> {
  const items: ReplayListItem[] = [];

  // 1. Netlify Blobs.
  try {
    const store = await netlifyStore();
    const { blobs } = await store.list();
    for (const b of blobs) {
      const raw = (await store.get(b.key, { type: "json" })) as unknown;
      const item = toListItem(b.key, raw, null);
      if (item) items.push(item);
    }
    return items.sort(byNewest);
  } catch {
    /* bukan di Netlify */
  }

  // 2. Vercel Blob.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "replays/", token: process.env.BLOB_READ_WRITE_TOKEN });
    for (const b of blobs) {
      const id = b.pathname.replace(/^replays\//, "").replace(/\.json$/, "");
      try {
        const res = await fetch(b.url);
        if (!res.ok) continue;
        const item = toListItem(id, await res.json(), b.uploadedAt ? new Date(b.uploadedAt).getTime() : null);
        if (item) items.push(item);
      } catch {
        /* lewati file rusak */
      }
    }
    return items.sort(byNewest);
  }

  // 3. File lokal (development).
  try {
    const files = await fs.readdir(DEV_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const id = f.replace(/\.json$/, "");
      try {
        const full = path.join(DEV_DIR, f);
        const raw = JSON.parse(await fs.readFile(full, "utf8")) as unknown;
        const stat = await fs.stat(full);
        const item = toListItem(id, raw, stat.mtimeMs);
        if (item) items.push(item);
      } catch {
        /* lewati */
      }
    }
  } catch {
    /* dir belum ada */
  }
  return items.sort(byNewest);
}

const byNewest = (a: ReplayListItem, b: ReplayListItem) => (b.createdAt ?? 0) - (a.createdAt ?? 0);

export async function deleteReplay(id: string): Promise<void> {
  if (!ID_RE.test(id)) return;

  // 1. Netlify Blobs.
  try {
    const store = await netlifyStore();
    await store.delete(id);
    return;
  } catch {
    /* bukan di Netlify */
  }

  // 2. Vercel Blob.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { del, list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: vercelKey(id), token: process.env.BLOB_READ_WRITE_TOKEN });
    if (blobs[0]) await del(blobs[0].url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return;
  }

  // 3. File lokal (development).
  try {
    await fs.unlink(path.join(DEV_DIR, `${id}.json`));
  } catch {
    /* sudah tidak ada */
  }
}

