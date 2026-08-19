import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { createEventWithReminder, deleteEvent } from "@/lib/googleCalendar";

async function loadOwnedTask(id, email) {
  const rows = await sql`
    SELECT id, date::text AS date, text, done, time, calendar_event_id, recurrence_id
    FROM tasks WHERE id = ${id} AND email = ${email}
  `;
  return rows[0] || null;
}

// PATCH { done }               -- 체크 토글
// PATCH { text, time, remind } -- 내용 수정 (필요시 구글 캘린더 일정 재생성)
// PATCH { date }               -- 다른 날짜로 이동(드래그 마이그레이션), 일정 있으면 새 날짜로 재생성
// 전부 본인 것만.
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = Number(params.id);
  const task = await loadOwnedTask(id, session.user.email);
  if (!task) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

  const body = await req.json();

  if (Object.prototype.hasOwnProperty.call(body, "done")) {
    await sql`UPDATE tasks SET done = ${!!body.done} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  }

  if (Object.prototype.hasOwnProperty.call(body, "text")) {
    const newText = (body.text || "").trim();
    if (!newText) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });

    const newTime = body.time || null;
    const wantReminder = !!body.remind;
    const textChanged = newText !== task.text;
    const timeChanged = newTime !== task.time;

    let calendarEventId = task.calendar_event_id;
    let calendarError = null;

    // 기존 일정이 있는데 알림을 껐거나, 내용/시간이 바뀌었으면 기존 일정은 지우고 다시 만든다.
    if (calendarEventId && (!wantReminder || textChanged || timeChanged)) {
      if (session.accessToken) {
        try {
          await deleteEvent(session.accessToken, calendarEventId);
        } catch (err) {
          console.error("구글 캘린더 일정 삭제 실패:", err);
          calendarError = `기존 구글 캘린더 일정 삭제에 실패했습니다: ${err?.message || "알 수 없는 오류"}`;
        }
      }
      calendarEventId = null;
    }

    if (wantReminder && !calendarEventId) {
      if (!session.accessToken) {
        calendarError = "구글 로그인 정보가 없어 캘린더에 등록하지 못했습니다.";
      } else {
        try {
          calendarEventId = await createEventWithReminder({
            accessToken: session.accessToken,
            text: newText,
            date: task.date,
            time: newTime,
          });
        } catch (err) {
          console.error("구글 캘린더 등록 실패:", err);
          calendarError = `구글 캘린더 등록에 실패했습니다: ${err?.message || "알 수 없는 오류"}`;
        }
      }
    }

    const rows = await sql`
      UPDATE tasks
      SET text = ${newText}, time = ${newTime}, calendar_event_id = ${calendarEventId}
      WHERE id = ${id}
      RETURNING id, date::text AS date, text, done, time,
        calendar_event_id AS "calendarEventId", recurrence_id AS "recurrenceId"
    `;
    return NextResponse.json({ task: rows[0], calendarError });
  }

  if (Object.prototype.hasOwnProperty.call(body, "date")) {
    const newDate = body.date;
    if (!newDate) return NextResponse.json({ error: "날짜가 필요합니다." }, { status: 400 });

    if (newDate === task.date) {
      return NextResponse.json({
        task: {
          id: task.id,
          date: task.date,
          text: task.text,
          done: task.done,
          time: task.time,
          calendarEventId: task.calendar_event_id,
          recurrenceId: task.recurrence_id,
        },
        calendarError: null,
      });
    }

    let calendarEventId = task.calendar_event_id;
    let calendarError = null;

    // 연결된 구글 캘린더 일정이 있으면 옛 날짜 일정은 지우고 새 날짜로 다시 만든다.
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
            date: newDate,
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

    const rows = await sql`
      UPDATE tasks
      SET date = ${newDate}, calendar_event_id = ${calendarEventId}
      WHERE id = ${id}
      RETURNING id, date::text AS date, text, done, time,
        calendar_event_id AS "calendarEventId", recurrence_id AS "recurrenceId"
    `;
    return NextResponse.json({ task: rows[0], calendarError });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}

// DELETE -- 본인 것만.
// 반복 시리즈의 일부라면 이 날짜(포함) 이후로 생성된 항목을 전부 같이 삭제한다.
// 연결된 구글 캘린더 일정이 있는 항목은 각각 삭제 시도.
export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = Number(params.id);
  const task = await loadOwnedTask(id, session.user.email);
  if (!task) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

  let calendarError = null;

  if (task.recurrence_id) {
    const futureRows = await sql`
      SELECT id, calendar_event_id
      FROM tasks
      WHERE email = ${session.user.email} AND recurrence_id = ${task.recurrence_id} AND date >= ${task.date}
    `;

    for (const row of futureRows) {
      if (row.calendar_event_id) {
        if (!session.accessToken) {
          calendarError = "구글 로그인 정보가 없어 캘린더 일정은 직접 지워야 합니다.";
        } else {
          try {
            await deleteEvent(session.accessToken, row.calendar_event_id);
          } catch (err) {
            console.error("구글 캘린더 일정 삭제 실패:", err);
            calendarError = `일부 구글 캘린더 일정 삭제에 실패했습니다: ${err?.message || "알 수 없는 오류"}`;
          }
        }
      }
    }

    await sql`
      DELETE FROM tasks
      WHERE email = ${session.user.email} AND recurrence_id = ${task.recurrence_id} AND date >= ${task.date}
    `;
    return NextResponse.json({ ok: true, calendarError, deletedCount: futureRows.length });
  }

  if (task.calendar_event_id) {
    if (!session.accessToken) {
      calendarError = "구글 로그인 정보가 없어 캘린더 일정은 직접 지워야 합니다.";
    } else {
      try {
        await deleteEvent(session.accessToken, task.calendar_event_id);
      } catch (err) {
        console.error("구글 캘린더 일정 삭제 실패:", err);
        calendarError = `구글 캘린더 일정 삭제에 실패했습니다: ${err?.message || "알 수 없는 오류"}`;
      }
    }
  }

  await sql`DELETE FROM tasks WHERE id = ${id}`;
  return NextResponse.json({ ok: true, calendarError, deletedCount: 1 });
}
