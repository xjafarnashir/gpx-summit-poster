import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_PRICING, parsePricing, type Pricing } from "@/lib/pricing";

/* ============================================================================
 * Penyimpanan harga sisi SERVER (dipakai route handler & server component).
 *
 * - Production (Netlify): Netlify Blobs — KV bawaan Netlify, otomatis
 *   terkonfigurasi di dalam function, tanpa API key / setup tambahan.
 * - Development (`next dev`): Blobs tidak punya konteks → fallback ke file
 *   .data/pricing.json di repo (di-gitignore).
 * Gagal baca dalam bentuk apa pun → DEFAULT_PRICING, jangan sampai landing
 * page ikut tumbang hanya karena penyimpanan harga bermasalah.
 * ========================================================================== */

const BLOB_STORE = "settings";
const BLOB_KEY = "pricing";
const DEV_FILE = path.join(process.cwd(), ".data", "pricing.json");

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  // Melempar bila di luar lingkungan Netlify (mis. next dev) — ditangkap pemanggil.
  return getStore(BLOB_STORE);
}

export async function readPricing(): Promise<Pricing> {
  // 1. Netlify Blobs (production).
  try {
    const store = await blobStore();
    const raw = (await store.get(BLOB_KEY, { type: "json" })) as unknown;
    const parsed = parsePricing(raw);
    if (parsed) return parsed;
  } catch {
    /* bukan di Netlify — coba file lokal */
  }

  // 2. File lokal (development).
  try {
    const raw = JSON.parse(await fs.readFile(DEV_FILE, "utf8")) as unknown;
    const parsed = parsePricing(raw);
    if (parsed) return parsed;
  } catch {
    /* belum pernah disetel */
  }

  return DEFAULT_PRICING;
}

export async function writePricing(pricing: Pricing): Promise<void> {
  // 1. Netlify Blobs (production).
  try {
    const store = await blobStore();
    await store.setJSON(BLOB_KEY, pricing);
    return;
  } catch {
    /* bukan di Netlify — tulis file lokal */
  }

  // 2. File lokal (development).
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(pricing), "utf8");
}
