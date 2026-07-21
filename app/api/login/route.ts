import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminPass, adminToken, adminUser } from "@/lib/adminAuth";
import { MEMBER_COOKIE, memberToken } from "@/lib/memberAuth";
import { verifyMemberLogin } from "@/lib/memberStore.server";

/**
 * Login: cocokkan kredensial.
 *   - admin  → cookie mk_admin  → arahkan ke /dashboard.
 *   - member → cookie mk_member → arahkan ke /editor.
 * Cookie berlaku 30 hari dan tidak berisi password (lihat adminAuth/memberAuth).
 */
export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  };

  // 1. Admin.
  if (username === adminUser() && password === adminPass()) {
    const res = NextResponse.json({ ok: true, role: "admin", redirect: "/dashboard" });
    res.cookies.set(ADMIN_COOKIE, await adminToken(), cookieOpts);
    return res;
  }

  // 2. Member (dibuat admin di dashboard).
  const memberId = await verifyMemberLogin(username, password);
  if (memberId) {
    const res = NextResponse.json({ ok: true, role: "member", redirect: "/editor" });
    res.cookies.set(MEMBER_COOKIE, await memberToken(memberId), cookieOpts);
    return res;
  }

  return NextResponse.json({ ok: false, error: "Username atau password salah." }, { status: 401 });
}
