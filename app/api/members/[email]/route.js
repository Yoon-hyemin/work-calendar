import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

async function activeAdminCountExcluding(email) {
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM members
    WHERE is_admin = TRUE AND status = 'active' AND email != ${email}
  `;
  return rows[0].count;
}

// 관리자 지정/해제
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "관리자만 가능합니다." }, { status: 403 });
  }
  const email = decodeURIComponent(params.email).toLowerCase();
  const { isAdmin } = await req.json();

  if (isAdmin === false && (await activeAdminCountExcluding(email)) === 0) {
    return NextResponse.json(
      { error: "마지막 남은 관리자는 권한을 해제할 수 없습니다." },
      { status: 400 }
    );
  }

  await sql`UPDATE members SET is_admin = ${!!isAdmin} WHERE email = ${email}`;
  return NextResponse.json({ ok: true });
}

// 접근 권한 회수 (완전 삭제 아님 -- 이력 보존을 위해 status만 변경하고 공유 관계 정리)
export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "관리자만 가능합니다." }, { status: 403 });
  }
  const email = decodeURIComponent(params.email).toLowerCase();

  if (email === session.user.email) {
    return NextResponse.json({ error: "본인 계정은 제거할 수 없습니다." }, { status: 400 });
  }
  if ((await activeAdminCountExcluding(email)) === 0) {
    const rows = await sql`SELECT is_admin FROM members WHERE email = ${email}`;
    if (rows[0]?.is_admin) {
      return NextResponse.json(
        { error: "마지막 남은 관리자는 제거할 수 없습니다." },
        { status: 400 }
      );
    }
  }

  await sql`UPDATE members SET status = 'removed' WHERE email = ${email}`;
  await sql`
    DELETE FROM shares WHERE viewer_email = ${email} OR target_email = ${email}
  `;
  return NextResponse.json({ ok: true });
}
