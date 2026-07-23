import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_PRICING, parsePricing, type Pricing } from "@/lib/pricing";

/* ============================================================================
 * Penyimpanan harga sisi SERVER (dipakai route handler & server component).
 * Urutan deteksi (sama dengan replay/member/order store):
 *   1. Netlify Blobs — bila berjalan di lingkungan Netlify.
 *   2. Vercel Blob   — bila BLOB_READ_WRITE_TOKEN tersedia (produksi Vercel).
 *   3. File lokal    — fallback development (.data/pricing.json, di-gitignore).
 *
 * Gagal baca dalam bentuk apa pun → DEFAULT_PRICING, jangan sampai landing
 * page ikut tumbang hanya karena penyimpanan harga bermasalah.
 * ========================================================================== */

const BLOB_STORE = "settings";
const BLOB_KEY = "pricing";
const DEV_FILE = path.join(process.cwd(), ".data", "pricing.json");

/* ----------------------------- Netlify Blobs ----------------------------- */

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  // Melempar bila di luar lingkungan Netlify (mis. next dev) — ditangkap pemanggil.
  return getStore(BLOB_STORE);
}

/* ------------------------------ Vercel Blob ------------------------------ */

/** Kunci objek Vercel Blob untuk harga. */
const vercelKey = () => `settings/${BLOB_KEY}.json`;

async function readVercelBlob(): Promise<Pricing | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const { list } = await import("@vercel/blob");
    // head() butuh URL lengkap, jadi cari lewat list() dengan prefix path.
    const response = await list({ prefix: vercelKey(), token });
    const blob = response.blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.url);
    if (!res.ok) return null;
    const raw = (await res.json()) as unknown;
    return parsePricing(raw);
  } catch {
    return null;
  }
}

async function writeVercelBlob(pricing: Pricing): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN tidak tersedia.");
  const { put } = await import("@vercel/blob");
  await put(vercelKey(), JSON.stringify(pricing), {
    access: "public",
    contentType: "application/json",
    token,
    // Timpa objek yang sama tiap simpan, jangan buat nama acak baru.
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/* ----------------------------- public API -------------------------------- */

export async function readPricing(): Promise<Pricing> {
  // 1. Netlify Blobs (production Netlify).
  try {
    const store = await blobStore();
    const raw = (await store.get(BLOB_KEY, { type: "json" })) as unknown;
    const parsed = parsePricing(raw);
    if (parsed) return parsed;
  } catch {
    /* bukan di Netlify — coba Vercel */
  }

  // 2. Vercel Blob (bila token tersedia).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const parsed = await readVercelBlob();
    if (parsed) return parsed;
  }

  // 3. File lokal (development).
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
  // 1. Netlify Blobs (production Netlify).
  try {
    const store = await blobStore();
    await store.setJSON(BLOB_KEY, pricing);
    return;
  } catch {
    /* bukan di Netlify — coba Vercel */
  }

  // 2. Vercel Blob (bila token tersedia).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await writeVercelBlob(pricing);
    return;
  }

  // 3. File lokal (development).
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(pricing), "utf8");
}
