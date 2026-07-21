import { promises as fs } from "fs";
import path from "path";
import { extractOrderPayload, type OrderPayload } from "@/lib/orderPayload";

/* ============================================================================
 * Penyimpanan PESANAN masuk sisi SERVER, per-id. Sebelumnya pesanan tidak
 * pernah disimpan (hanya jadi pesan WhatsApp); sekarang landing page auto-POST
 * ke /api/order supaya muncul di dashboard admin.
 *
 * Backend sama seperti replay: Netlify Blobs → Vercel Blob → file lokal
 * (.data/orders/<id>.json). Tiap objek = { id, createdAt, payload }.
 * ========================================================================== */

export interface OrderRecord {
  id: string;
  createdAt: number;
  payload: OrderPayload;
}

const BLOB_STORE = "orders";
const DEV_DIR = path.join(process.cwd(), ".data", "orders");
const ID_RE = /^[a-f0-9]{12}$/;

export function generateOrderId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/** Validasi payload pesanan lewat parser WA yang sudah ada (melempar bila invalid). */
export function parseOrderPayload(raw: unknown): OrderPayload {
  // extractOrderPayload menerima teks bebas; JSON.stringify lalu diekstrak lagi
  // memakai validasi yang sama persis dengan panel Impor di editor.
  return extractOrderPayload(JSON.stringify(raw));
}

function toRecord(raw: unknown): OrderRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.createdAt !== "number") return null;
  try {
    return { id: o.id, createdAt: o.createdAt, payload: parseOrderPayload(o.payload) };
  } catch {
    return null;
  }
}

/* ----------------------------- Netlify Blobs ----------------------------- */

async function netlifyStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(BLOB_STORE); // melempar di luar Netlify — ditangkap pemanggil
}

/* ------------------------------ Vercel Blob ------------------------------ */

const vercelKey = (id: string) => `orders/${id}.json`;

/* ----------------------------- public API -------------------------------- */

export async function saveOrder(payload: OrderPayload): Promise<OrderRecord> {
  const record: OrderRecord = { id: generateOrderId(), createdAt: Date.now(), payload };
  const json = JSON.stringify(record);

  // 1. Netlify Blobs.
  try {
    const store = await netlifyStore();
    await store.setJSON(record.id, record);
    return record;
  } catch {
    /* bukan di Netlify */
  }
  // 2. Vercel Blob.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    await put(vercelKey(record.id), json, {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return record;
  }
  // 3. File lokal (development).
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.writeFile(path.join(DEV_DIR, `${record.id}.json`), json, "utf8");
  return record;
}

export async function listOrders(): Promise<OrderRecord[]> {
  const records: OrderRecord[] = [];

  // 1. Netlify Blobs.
  try {
    const store = await netlifyStore();
    const { blobs } = await store.list();
    for (const b of blobs) {
      const raw = (await store.get(b.key, { type: "json" })) as unknown;
      const rec = toRecord(raw);
      if (rec) records.push(rec);
    }
    return records.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    /* bukan di Netlify */
  }
  // 2. Vercel Blob.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "orders/", token: process.env.BLOB_READ_WRITE_TOKEN });
    for (const b of blobs) {
      try {
        const res = await fetch(b.url);
        if (!res.ok) continue;
        const rec = toRecord(await res.json());
        if (rec) records.push(rec);
      } catch {
        /* lewati file rusak */
      }
    }
    return records.sort((a, b) => b.createdAt - a.createdAt);
  }
  // 3. File lokal (development).
  try {
    const files = await fs.readdir(DEV_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const rec = toRecord(JSON.parse(await fs.readFile(path.join(DEV_DIR, f), "utf8")));
        if (rec) records.push(rec);
      } catch {
        /* lewati */
      }
    }
  } catch {
    /* dir belum ada */
  }
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteOrder(id: string): Promise<void> {
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
