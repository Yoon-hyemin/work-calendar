import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

// 관리자가 승인 절차 없이 두 사람을 바로 연결 (viewerEmail이 targetEmail의 캘린더를 보게 됨).
export async function POST(req) {
  const session = await requireSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "관리자만 가능합니다." }, { status: 403 });
  }

  const { viewerEmail: rawViewer, targetEmail: rawTarget } = await req.json();
  const viewerEmail = (rawViewer || "").trim().toLowerCase();
  const targetEmail = (rawTarget || "").trim().toLowerCase();

  if (!viewerEmail || !targetEmail || viewerEmail === targetEmail) {
    return NextResponse.json({ error: "대상을 올바르게 선택해주세요." }, { status: 400 });
  }

  await sql`
    INSERT INTO shares (viewer_email, target_email, status)
    VALUES (${viewerEmail}, ${targetEmail}, 'approved')
    ON CONFLICT (viewer_email, target_email) DO UPDATE SET status = 'approved'
  `;
  return NextResponse.json({ ok: true });
}
