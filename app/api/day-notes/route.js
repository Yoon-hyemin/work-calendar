import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { canView } from "@/lib/scope";

// GET ?targetEmail=&date=          -> { memo, readOnly }        (모달용, 단건)
// GET ?targetEmail=&year=&month=   -> { notes: { 'YYYY-MM-DD': memo } } (리포트용, 월 전체)
export async function GET(req) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetEmail = (searchParams.get("targetEmail") || session.user.email).toLowerCase();
  const date = searchParams.get("date");
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  const allowed = await canView(session.user.email, targetEmail, session.user.isAdmin);
  if (!allowed) {
    return NextResponse.json({ error: "이 캘린더를 볼 권한이 없습니다." }, { status: 403 });
  }

  if (date) {
    const rows = await sql`
      SELECT memo FROM day_notes WHERE email = ${targetEmail} AND date = ${date}
    `;
    return NextResponse.json({
      memo: rows[0]?.memo || "",
      readOnly: targetEmail !== session.user.email,
    });
  }

  if (!year || !month) {
    return NextResponse.json({ error: "date 또는 year/month가 필요합니다." }, { status: 400 });
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const rows = await sql`
    SELECT date::text AS date, memo
    FROM day_notes
    WHERE email = ${targetEmail} AND date >= ${startDate} AND date < ${endDate} AND memo != ''
  `;

  const notes = {};
  for (const r of rows) notes[r.date] = r.memo;
  return NextResponse.json({ notes });
}

// PUT { date, memo } -- 로그인한 본인 이메일로만 저장.
export async function PUT(req) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { date, memo } = await req.json();
  if (!date) return NextResponse.json({ error: "날짜가 필요합니다." }, { status: 400 });

  await sql`
    INSERT INTO day_notes (email, date, memo, updated_at)
    VALUES (${session.user.email}, ${date}, ${memo || ""}, now())
    ON CONFLICT (email, date) DO UPDATE SET memo = ${memo || ""}, updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}
