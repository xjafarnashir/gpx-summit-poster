/* ============================================================================
 * Cookie & tanda tangan untuk MEMBER (operator editor yang dibuat admin).
 *
 * Beda peran dengan admin (lib/adminAuth.ts):
 *   - admin  → cookie mk_admin  → boleh /dashboard + semua tools + API admin.
 *   - member → cookie mk_member → HANYA /, /editor, /api/replay, /api/member/*.
 *
 * Cookie member TIDAK berisi password: isinya "<id>.<sig>" dengan
 * sig = SHA-256(id:secret). Verifikasi dihitung ulang di proxy (edge) & di
 * route handler (Node) — keduanya punya Web Crypto, jadi modul ini aman di
 * kedua runtime. Id member = hex tanpa titik, jadi split "." tidak ambigu.
 *
 * PENTING saat deploy: set env MEMBER_SECRET agar tanda tangan tidak bisa
 * ditebak dari kredensial admin. Bila kosong, secret diturunkan dari kredensial
 * admin (mengganti password admin otomatis meng-invalidasi semua cookie member).
 * ========================================================================== */

import { adminPass, adminUser } from "@/lib/adminAuth";

export const MEMBER_COOKIE = "mk_member";

function memberSecret(): string {
  return process.env.MEMBER_SECRET || `${adminUser()}:${adminPass()}:mykoordinat-member-v1`;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash password member — disimpan di store, tidak pernah plaintext. */
export async function hashMemberPassword(username: string, password: string): Promise<string> {
  return sha256Hex(`${username.toLowerCase()}:${password}:mk-member-pw-v1`);
}

/** Nilai cookie untuk member id tertentu: "<id>.<sig>". */
export async function memberToken(id: string): Promise<string> {
  return `${id}.${await sha256Hex(`${id}:${memberSecret()}`)}`;
}

/** Kembalikan id member bila cookie valid, null bila tidak. */
export async function verifyMemberToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sha256Hex(`${id}:${memberSecret()}`);
  // Panjang hex tetap 64 → perbandingan konstan-panjang sudah cukup di sini.
  return sig === expected ? id : null;
}
