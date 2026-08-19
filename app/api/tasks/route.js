import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { canView } from "@/lib/scope";
import { createEventWithReminder } from "@/lib/googleCalendar";

// GET /api/tasks?targetEmail=...&year=2026&month=8
export async function GET(req) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetEmail = (searchParams.get("targetEmail") || session.user.email).toLowerCase();
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month) {
    return NextResponse.json({ error: "year, month가 필요합니다." }, { status: 400 });
  }

  const allowed = await canView(session.user.email, targetEmail, session.user.isAdmin);
  if (!allowed) {
    return NextResponse.json({ error: "이 캘린더를 볼 권한이 없습니다." }, { status: 403 });
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const tasks = await sql`
    SELECT id, date::text AS date, text, done, time,
           calendar_event_id AS "calendarEventId", recurrence_id AS "recurrenceId"
    FROM tasks
    WHERE email = ${targetEmail} AND date >= ${startDate} AND date < ${endDate}
    ORDER BY date, id
  `;

  return NextResponse.json({
    tasks,
    readOnly: targetEmail !== session.user.email,
  });
}

// POST { date, text, remind, time }
export async function POST(req) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { date, text, remind, time } = await req.json();
  if (!date || !text?.trim()) {
    return NextResponse.json({ error: "날짜와 내용을 입력해주세요." }, { status: 400 });
  }

  let calendarEventId = null;
  let calendarError = null;

  if (remind) {
    if (!session.accessToken) {
      calendarError = "구글 로그인 정보가 없어 캘린더에 등록하지 못했습니다.";
    } else {
      try {
        calendarEventId = await createEventWithReminder({
          accessToken: session.accessToken,
          text: text.trim(),
          date,
          time: time || null,
        });
      } catch (err) {
        console.error("구글 캘린더 등록 실패:", err);
        calendarError = `구글 캘린더 등록에 실패했습니다: ${err?.message || "알 수 없는 오류"}`;
      }
    }
  }

  const rows = await sql`
    INSERT INTO tasks (email, date, text, done, time, calendar_event_id)
    VALUES (${session.user.email}, ${date}, ${text.trim()}, FALSE, ${time || null}, ${calendarEventId})
    RETURNING id, date::text AS date, text, done, time,
      calendar_event_id AS "calendarEventId", recurrence_id AS "recurrenceId"
  `;

  return NextResponse.json({ task: rows[0], calendarError });
}
