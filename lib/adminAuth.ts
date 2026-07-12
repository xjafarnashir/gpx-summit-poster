/* ============================================================================
 * Kredensial admin + token cookie.
 *
 * PENTING saat deploy: set env ADMIN_USER dan ADMIN_PASS di dashboard hosting
 * untuk menimpa nilai default di bawah — terutama kalau repo ini publik.
 *
 * Cookie TIDAK berisi password: isinya SHA-256(user:pass:salt), dihitung ulang
 * dan dicocokkan di proxy pada tiap request. Web Crypto tersedia baik di edge
 * runtime (proxy) maupun Node (route handler), jadi modul ini aman dipakai
 * di keduanya.
 * ========================================================================== */

export const ADMIN_COOKIE = "mk_admin";

export function adminUser(): string {
  return process.env.ADMIN_USER || "jafarnashir";
}

export function adminPass(): string {
  return process.env.ADMIN_PASS || "abogoboga";
}

export async function adminToken(): Promise<string> {
  const data = new TextEncoder().encode(`${adminUser()}:${adminPass()}:mykoordinat-v1`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
