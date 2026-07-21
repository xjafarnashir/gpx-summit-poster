import { NextResponse, type NextRequest } from "next/server";
import { memberIdFromRequest } from "@/lib/apiAuth";
import { incrementMemberExport } from "@/lib/memberStore.server";

/**
 * POST /api/member/export — catat 1 ekspor (Export Full) untuk member yang
 * sedang login. Ekspor oleh admin tidak punya cookie member → tidak dihitung
 * (counted:false), dan itu memang diinginkan.
 */
export async function POST(request: NextRequest) {
  const memberId = await memberIdFromRequest(request);
  if (!memberId) return NextResponse.json({ ok: true, counted: false });
  await incrementMemberExport(memberId);
  return NextResponse.json({ ok: true, counted: true });
}
