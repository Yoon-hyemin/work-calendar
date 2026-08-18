import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { canView } from "@/lib/scope";

// 관리자: 팀원 관리 화면용 전체 목록.
// 일반 사용자: 캘린더 전환 드롭다운용 -- 본인 + 승인받아 볼 수 있는 사람만.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const all = await sql`
    SELECT email, name, is_admin AS "isAdmin", status
    FROM members
    ORDER BY name
  `;

  if (session.user.isAdmin) {
    return NextResponse.json({ members: all });
  }

  const viewable = [];
  for (const m of all) {
    if (m.status !== "active") continue;
    if (await canView(session.user.email, m.email, false)) {
      viewable.push(m);
    }
  }
  return NextResponse.json({ members: viewable });
}
