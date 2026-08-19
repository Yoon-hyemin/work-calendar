import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

// "무한반복"은 실제로는 끝없이 만들 수 없으니 주기별로 적당한 기간만큼만 미리 만들어둔다.
const INFINITE_HORIZON_YEARS = { daily: 1, weekly: 1, monthly: 2, yearly: 10 };
// 명시적 종료일을 아무리 멀게 잡아도 개수로 상한을 둔다(대량 생성/타임아웃 방지).
const MAX_OCCURRENCES = 500;
const VALID_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// 월/년 단위 이동 시 목표 달의 마지막 날짜로 clamp (예: 1/31 매월 반복 -> 2월엔 2/28).
function addMonthsClamped(dateStr, months) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(y, targetMonthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfTargetMonth);
  return new Date(Date.UTC(y, targetMonthIndex, day)).toISOString().slice(0, 10);
}

function nextOccurrence(anchorDate, frequency, n) {
  if (frequency === "weekly") return addDays(anchorDate, n * 7);
  if (frequency === "monthly") return addMonthsClamped(anchorDate, n);
  if (frequency === "yearly") return addMonthsClamped(anchorDate, n * 12);
  return addDays(anchorDate, n); // daily
}

// POST { frequency: 'daily'|'weekly'|'monthly'|'yearly', endDate: 'YYYY-MM-DD' | null }
// endDate가 null이면 무한반복 -- 주기별로 정해둔 기간만큼만 미리 생성.
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

  const body = await req.json();
  const frequency = VALID_FREQUENCIES.includes(body.frequency) ? body.frequency : "daily";
  const endDate = body.endDate || null;

  const finalEndDate =
    endDate || addMonthsClamped(task.date, (INFINITE_HORIZON_YEARS[frequency] || 1) * 12);

  if (finalEndDate <= task.date) {
    return NextResponse.json({ error: "종료일은 시작일보다 나중이어야 합니다." }, { status: 400 });
  }

  const dates = [];
  let n = 1;
  let cursor = nextOccurrence(task.date, frequency, n);
  while (cursor <= finalEndDate && dates.length < MAX_OCCURRENCES) {
    dates.push(cursor);
    n += 1;
    cursor = nextOccurrence(task.date, frequency, n);
  }

  let note = null;
  if (cursor <= finalEndDate) {
    note = `한 번에 최대 ${MAX_OCCURRENCES}개까지만 만들어져요. 그 이후에도 계속하려면 그때 다시 반복 설정해주세요.`;
  }

  await sql`UPDATE tasks SET recurrence_id = ${id} WHERE id = ${id}`;

  if (dates.length > 0) {
    // 하나씩 따로 INSERT하면 수백 번 왕복해서 느리고 타임아웃 위험이 있어
    // unnest로 한 번에 벌크 삽입한다.
    await sql`
      INSERT INTO tasks (email, date, text, done, time, recurrence_id)
      SELECT ${session.user.email}, d::date, ${task.text}, FALSE, ${task.time}, ${id}
      FROM unnest(${dates}::date[]) AS d
    `;
  }

  return NextResponse.json({ ok: true, count: dates.length + 1, note });
}
