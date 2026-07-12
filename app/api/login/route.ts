import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminPass, adminToken, adminUser } from "@/lib/adminAuth";

/** Login admin: cocokkan username+password, pasang cookie token (30 hari). */
export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  if (body.username !== adminUser() || body.password !== adminPass()) {
    return NextResponse.json({ ok: false, error: "Username atau password salah." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
