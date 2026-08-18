import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

// 공유 요청 대상을 고르기 위한 "전체 활성 팀원" 목록 (이름/이메일만).
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const rows = await sql`
    SELECT email, name
    FROM members
    WHERE status = 'active' AND email != ${session.user.email}
    ORDER BY name
  `;
  return NextResponse.json({ members: rows });
}
