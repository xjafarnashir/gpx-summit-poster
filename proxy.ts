import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken } from "@/lib/adminAuth";
import { MEMBER_COOKIE, verifyMemberToken } from "@/lib/memberAuth";

/* ============================================================================
 * Gerbang akses saat production/deploy.
 *
 * Publik hanya bisa membuka /landingpage. Halaman tools (setup poster "/",
 * "/editor", dst.) hanya untuk admin yang sudah login di /admin — kredensial
 * dicek /api/login yang memasang cookie token (SHA-256, bukan password).
 *
 * Saat `next dev` (development) gerbang nonaktif supaya kerja lokal lancar.
 * Set env ADMIN_USER + ADMIN_PASS di hosting untuk menimpa kredensial default
 * (lihat lib/adminAuth.ts).
 * ========================================================================== */

export async function proxy(req: NextRequest) {
  if (process.env.NODE_ENV === "development") return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Route publik: landing page, halaman login admin, endpoint login, harga
  // paket (GET publik; POST dijaga cookie di handler), dan simpan pesanan
  // (/api/order POST dipanggil customer dari landing → wajib publik).
  if (
    pathname === "/landingpage" ||
    pathname.startsWith("/landingpage/") ||
    pathname === "/admin" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/pricing" ||
    pathname === "/api/order"
  ) {
    return NextResponse.next();
  }

  // Admin ber-cookie valid bebas ke mana pun (termasuk /dashboard & /api/admin/*).
  if (req.cookies.get(ADMIN_COOKIE)?.value === (await adminToken())) {
    return NextResponse.next();
  }

  // Member ber-cookie valid: HANYA tools editor + API miliknya. Dashboard dan
  // API admin tetap tertutup untuk member.
  const isAdminOnly = pathname === "/dashboard" || pathname.startsWith("/api/admin/");
  if (!isAdminOnly && (await verifyMemberToken(req.cookies.get(MEMBER_COOKIE)?.value))) {
    return NextResponse.next();
  }

  // Selainnya: arahkan ke landing page.
  return NextResponse.redirect(new URL("/landingpage", req.url));
}

export const config = {
  // Jalankan untuk semua route KECUALI internal Next (_next) dan file statis
  // ber-ekstensi (foto poster, ikon, dll di /public).
  matcher: ["/((?!_next|.*\\..*).*)"],
};
