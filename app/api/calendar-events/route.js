import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { listMonthEvents } from "@/lib/googleCalendar";

// 본인의 실제 구글 캘린더 일정만 읽어올 수 있음 (다른 사람 것은 구글 정책상 불가).
export async function GET(req) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const targetEmail = (searchParams.get("targetEmail") || session.user.email).toLowerCase();

  // 본인 캘린더를 보는 중이 아니면 실제 구글 일정은 애초에 요청하지 않는다.
  if (targetEmail !== session.user.email) {
    return NextResponse.json({ events: [] });
  }

  if (!session.accessToken) {
    return NextResponse.json({ events: [], error: "구글 로그인 정보가 없습니다." });
  }

  try {
    const events = await listMonthEvents(session.accessToken, year, month);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("구글 캘린더 조회 실패:", err);
    return NextResponse.json(
      { events: [], error: `구글 캘린더를 불러오지 못했습니다: ${err?.message || "알 수 없는 오류"}` },
      { status: 200 }
    );
  }
}
