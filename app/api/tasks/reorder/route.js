import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { createEventWithReminder, deleteEvent } from "@/lib/googleCalendar";

// PATCH { movedTaskId, targetDate, orderedIds }
// targetDate 하루치 할일 전체를 orderedIds 순서대로 재배열한다(0부터 순번 매김).
// movedTaskId가 원래 다른 날짜였다면 targetDate로 옮기는 것까지 한 번에 처리
// (연결된 구글 캘린더 일정이 있으면 새 날짜로 재생성).
export async function PATCH(req) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { movedTaskId, targetDate, orderedIds } = await req.json();
  if (!movedTaskId || !targetDate || !Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, date::text AS date, text, time, calendar_event_id
    FROM tasks WHERE id = ${movedTaskId} AND email = ${session.user.email}
  `;
  const task = rows[0];
  if (!task) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

  let calendarError = null;

  if (task.date !== targetDate) {
    let calendarEventId = task.calendar_event_id;
    if (calendarEventId) {
      if (!session.accessToken) {
        calendarError = "구글 로그인 정보가 없어 캘린더 일정은 직접 옮겨야 합니다.";
      } else {
        try {
          await deleteEvent(session.accessToken, calendarEventId);
        } catch (err) {
          console.error("구글 캘린더 일정 삭제 실패:", err);
          calendarError = `기존 구글 캘린더 일정 삭제에 실패했습니다: ${err?.message || "알 수 없는 오류"}`;
        }
        calendarEventId = null;

        try {
          calendarEventId = await createEventWithReminder({
            accessToken: session.accessToken,
            text: task.text,
            date: targetDate,
            time: task.time,
          });
        } catch (err) {
          console.error("구글 캘린더 등록 실패:", err);
          calendarError =
            (calendarError ? calendarError + " " : "") +
            `새 날짜로 캘린더 일정을 다시 만들지 못했습니다: ${err?.message || "알 수 없는 오류"}`;
        }
      }
    }
    await sql`
      UPDATE tasks SET date = ${targetDate}, calendar_event_id = ${calendarEventId}
      WHERE id = ${movedTaskId}
    `;
  }

  if (orderedIds.length > 0) {
    const indexes = orderedIds.map((_, i) => i);
    await sql`
      UPDATE tasks AS t
      SET order_index = data.idx
      FROM (SELECT unnest(${orderedIds}::int[]) AS id, unnest(${indexes}::int[]) AS idx) AS data
      WHERE t.id = data.id AND t.email = ${session.user.email}
    `;
  }

  return NextResponse.json({ ok: true, calendarError });
}
