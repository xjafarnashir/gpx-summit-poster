import { promises as fs } from "fs";
import path from "path";
import { hashMemberPassword } from "@/lib/memberAuth";

/* ============================================================================
 * Penyimpanan MEMBER (operator editor) sisi SERVER — satu daftar JSON.
 *
 * Pola sama dengan pricingStore: Netlify Blobs → Vercel Blob (BLOB_READ_WRITE_TOKEN)
 * → file .data/members.json (dev). Password TIDAK disimpan plaintext — hanya hash
 * (lihat hashMemberPassword).
 * ========================================================================== */

export interface MemberRecord {
  id: string;
  username: string;
  passwordHash: string;
  exportCount: number;
  createdAt: number;
  lastExportAt: number | null;
}

/** Member tanpa hash — aman dikirim ke dashboard. */
export type MemberPublic = Omit<MemberRecord, "passwordHash">;

const BLOB_STORE = "settings";
const BLOB_KEY = "members";
const DEV_FILE = path.join(process.cwd(), ".data", "members.json");

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(BLOB_STORE); // melempar di luar Netlify — ditangkap pemanggil
}

/* ------------------------------ Vercel Blob ------------------------------ */

const vercelKey = () => `settings/${BLOB_KEY}.json`;

async function readVercelBlob(): Promise<MemberRecord[] | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const { list } = await import("@vercel/blob");
    const response = await list({ prefix: vercelKey(), token });
    const blob = response.blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.url);
    if (!res.ok) return null;
    return parseMembers((await res.json()) as unknown);
  } catch {
    return null;
  }
}

async function writeVercelBlob(list: MemberRecord[]): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN tidak tersedia.");
  const { put } = await import("@vercel/blob");
  await put(vercelKey(), JSON.stringify(list), {
    access: "public",
    contentType: "application/json",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function parseMembers(raw: unknown): MemberRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: MemberRecord[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.username !== "string" || typeof o.passwordHash !== "string") continue;
    out.push({
      id: o.id,
      username: o.username,
      passwordHash: o.passwordHash,
      exportCount: typeof o.exportCount === "number" ? o.exportCount : 0,
      createdAt: typeof o.createdAt === "number" ? o.createdAt : 0,
      lastExportAt: typeof o.lastExportAt === "number" ? o.lastExportAt : null,
    });
  }
  return out;
}

export async function readMembers(): Promise<MemberRecord[]> {
  // 1. Netlify Blobs (production).
  try {
    const store = await blobStore();
    const raw = (await store.get(BLOB_KEY, { type: "json" })) as unknown;
    if (raw != null) return parseMembers(raw);
  } catch {
    /* bukan di Netlify — coba Vercel */
  }
  // 2. Vercel Blob (bila token tersedia).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const parsed = await readVercelBlob();
    if (parsed != null) return parsed;
  }
  // 3. File lokal (development).
  try {
    return parseMembers(JSON.parse(await fs.readFile(DEV_FILE, "utf8")));
  } catch {
    return [];
  }
}

async function writeMembers(list: MemberRecord[]): Promise<void> {
  // 1. Netlify Blobs (production).
  try {
    const store = await blobStore();
    await store.setJSON(BLOB_KEY, list);
    return;
  } catch {
    /* bukan di Netlify — coba Vercel */
  }
  // 2. Vercel Blob (bila token tersedia).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await writeVercelBlob(list);
    return;
  }
  // 3. File lokal (development).
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(list), "utf8");
}

const toPublic = (m: MemberRecord): MemberPublic => {
  const { passwordHash: _hash, ...pub } = m;
  void _hash;
  return pub;
};

export async function listMembers(): Promise<MemberPublic[]> {
  return (await readMembers()).map(toPublic);
}

/** Buat member baru. Username unik (case-insensitive). */
export async function addMember(
  username: string,
  password: string
): Promise<{ ok: true; member: MemberPublic } | { ok: false; error: string }> {
  const uname = username.trim();
  if (uname.length < 3) return { ok: false, error: "Username minimal 3 karakter." };
  if (password.length < 4) return { ok: false, error: "Password minimal 4 karakter." };

  const list = await readMembers();
  if (list.some((m) => m.username.toLowerCase() === uname.toLowerCase())) {
    return { ok: false, error: "Username sudah dipakai." };
  }
  const member: MemberRecord = {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    username: uname,
    passwordHash: await hashMemberPassword(uname, password),
    exportCount: 0,
    createdAt: Date.now(),
    lastExportAt: null,
  };
  await writeMembers([...list, member]);
  return { ok: true, member: toPublic(member) };
}

export async function deleteMember(id: string): Promise<void> {
  const list = await readMembers();
  await writeMembers(list.filter((m) => m.id !== id));
}

/** Cocokkan login member → id bila valid, null bila tidak. */
export async function verifyMemberLogin(username: string, password: string): Promise<string | null> {
  const list = await readMembers();
  const member = list.find((m) => m.username.toLowerCase() === username.trim().toLowerCase());
  if (!member) return null;
  const hash = await hashMemberPassword(member.username, password);
  return hash === member.passwordHash ? member.id : null;
}

/** Naikkan penghitung ekspor member (dipanggil setelah Export Full sukses). */
export async function incrementMemberExport(id: string): Promise<void> {
  const list = await readMembers();
  const member = list.find((m) => m.id === id);
  if (!member) return;
  member.exportCount += 1;
  member.lastExportAt = Date.now();
  await writeMembers(list);
}
