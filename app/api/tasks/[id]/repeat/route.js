import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

// "무한반복"은 실제로는 끝없이 만들 수 없으니 1년치를 미리 만들어둔다.
// 명시적으로 종료일을 지정해도 최대 3년까지만 허용(대량 생성 방지 안전장치).
const INFINITE_HORIZON_DAYS = 365;
const MAX_HORIZON_DAYS = 1095;

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// POST { endDate: 'YYYY-MM-DD' | null } -- null이면 무한반복(1년치 생성)
export async function POST(req, { params }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = Number(params.id);
  const rows = await sql`
    SELECT id, date::text AS date, text, time, recurrence_id
    FROM tasks WHERE id = ${id} AND email = ${session.user.email}
  `;
  const task = rows[0];
  if (!task) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  if (task.recurrence_id) {
    return NextResponse.json({ error: "이미 반복 설정된 항목입니다." }, { status: 400 });
  }

  const { endDate } = await req.json();

  let finalEndDate = endDate || addDays(task.date, INFINITE_HORIZON_DAYS);
  let note = null;
  const capDate = addDays(task.date, MAX_HORIZON_DAYS);
  if (finalEndDate > capDate) {
    finalEndDate = capDate;
    note = `반복은 한 번에 최대 ${MAX_HORIZON_DAYS}일치까지만 만들어져요. 그 이후에도 계속하려면 그때 다시 반복 설정해주세요.`;
  }
  if (finalEndDate <= task.date) {
    return NextResponse.json({ error: "종료일은 시작일보다 나중이어야 합니다." }, { status: 400 });
  }

  const dates = [];
  let cursor = addDays(task.date, 1);
  while (cursor <= finalEndDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  await sql`UPDATE tasks SET recurrence_id = ${id} WHERE id = ${id}`;

  if (dates.length > 0) {
    // 하루하루 따로 INSERT하면 수백 번 왕복해서 느리고 타임아웃 위험이 있어
    // unnest로 한 번에 벌크 삽입한다.
    await sql`
      INSERT INTO tasks (email, date, text, done, time, recurrence_id)
      SELECT ${session.user.email}, d::date, ${task.text}, FALSE, ${task.time}, ${id}
      FROM unnest(${dates}::date[]) AS d
    `;
  }

  return NextResponse.json({ ok: true, count: dates.length + 1, note });
}
