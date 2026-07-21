import { type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken } from "@/lib/adminAuth";
import { MEMBER_COOKIE, verifyMemberToken } from "@/lib/memberAuth";

/* ============================================================================
 * Pengecekan peran untuk ROUTE HANDLER (Node). Proxy sudah menjaga akses di
 * production, tapi handler tetap cek ulang (defense-in-depth) — kecuali saat
 * `next dev`, di mana proxy nonaktif supaya kerja lokal lancar.
 * ========================================================================== */

const isDev = () => process.env.NODE_ENV === "development";

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  if (isDev()) return true;
  return req.cookies.get(ADMIN_COOKIE)?.value === (await adminToken());
}

/**
 * Id member dari cookie (null bila bukan member). Tidak di-bypass saat dev:
 * penghitung ekspor harus tercatat ke member yang benar, dan admin memang tak
 * punya id member.
 */
export async function memberIdFromRequest(req: NextRequest): Promise<string | null> {
  return verifyMemberToken(req.cookies.get(MEMBER_COOKIE)?.value);
}
