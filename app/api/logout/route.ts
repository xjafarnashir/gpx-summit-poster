import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/adminAuth";
import { MEMBER_COOKIE } from "@/lib/memberAuth";

/** POST /api/logout — hapus cookie admin & member, lalu client arahkan ke /admin. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const name of [ADMIN_COOKIE, MEMBER_COOKIE]) {
    res.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return res;
}
