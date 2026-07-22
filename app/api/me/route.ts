import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest, memberIdFromRequest } from "@/lib/apiAuth";

/**
 * GET /api/me — peran pemakai saat ini dari cookie: "admin" | "member" | null.
 * Dipakai AppHeader untuk menampilkan tombol khusus admin (Dashboard, Logout)
 * tanpa membocorkan cookie httpOnly ke JS. Saat `next dev` isAdminRequest
 * selalu true (bypass, sama seperti proxy) → header menampilkan menu admin.
 */
export async function GET(request: NextRequest) {
  if (await isAdminRequest(request)) return NextResponse.json({ role: "admin" });
  if (await memberIdFromRequest(request)) return NextResponse.json({ role: "member" });
  return NextResponse.json({ role: null });
}
