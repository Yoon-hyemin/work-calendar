import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { deleteEvent } from "@/lib/googleCalendar";

async function loadOwnedTask(id, email) {
  const rows = await sql`SELECT * FROM tasks WHERE id = ${id} AND email = ${email}`;
  return rows[0] || null;
}

// PATCH { done } -- 체크 토글. 본인 것만.
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = Number(params.id);
  const task = await loadOwnedTask(id, session.user.email);
  if (!task) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

  const { done } = await req.json();
  await sql`UPDATE tasks SET done = ${!!done} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

// DELETE -- 본인 것만. 연결된 구글 캘린더 일정도 같이 삭제 시도.
export async function DELETE(req, { params }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = Number(params.id);
  const task = await loadOwnedTask(id, session.user.email);
  if (!task) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

  let calendarError = null;
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
  return NextResponse.json({ ok: true, calendarError });
}
