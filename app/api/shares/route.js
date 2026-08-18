import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

// 관리자: 팀 전체의 대기중/승인된 공유 목록.
// 일반 사용자: 본인이 보낸(viewer) 요청만.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const rows = session.user.isAdmin
    ? await sql`
        SELECT s.id, s.viewer_email AS "viewerEmail", vm.name AS "viewerName",
               s.target_email AS "targetEmail", tm.name AS "targetName",
               s.status, s.created_at AS "createdAt"
        FROM shares s
        JOIN members vm ON vm.email = s.viewer_email
        JOIN members tm ON tm.email = s.target_email
        ORDER BY s.created_at DESC
      `
    : await sql`
        SELECT s.id, s.viewer_email AS "viewerEmail", vm.name AS "viewerName",
               s.target_email AS "targetEmail", tm.name AS "targetName",
               s.status, s.created_at AS "createdAt"
        FROM shares s
        JOIN members vm ON vm.email = s.viewer_email
        JOIN members tm ON tm.email = s.target_email
        WHERE s.viewer_email = ${session.user.email}
        ORDER BY s.created_at DESC
      `;

  return NextResponse.json({
    pending: rows.filter((r) => r.status === "pending"),
    approved: rows.filter((r) => r.status === "approved"),
  });
}

// 팀원이 다른 팀원의 캘린더를 보고 싶다고 요청.
export async function POST(req) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { targetEmail: rawTarget } = await req.json();
  const targetEmail = (rawTarget || "").trim().toLowerCase();
  const viewerEmail = session.user.email;

  if (!targetEmail || targetEmail === viewerEmail) {
    return NextResponse.json({ error: "대상을 올바르게 선택해주세요." }, { status: 400 });
  }

  const target = await sql`SELECT 1 FROM members WHERE email = ${targetEmail} AND status = 'active'`;
  if (target.length === 0) {
    return NextResponse.json({ error: "존재하지 않는 팀원입니다." }, { status: 404 });
  }

  const existing = await sql`
    SELECT status FROM shares WHERE viewer_email = ${viewerEmail} AND target_email = ${targetEmail}
  `;
  if (existing.length > 0) {
    const msg = existing[0].status === "approved" ? "이미 공유중입니다." : "이미 요청을 보냈습니다.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await sql`
    INSERT INTO shares (viewer_email, target_email, status)
    VALUES (${viewerEmail}, ${targetEmail}, 'pending')
  `;
  return NextResponse.json({ ok: true });
}
