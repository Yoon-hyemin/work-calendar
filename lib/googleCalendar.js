import { google } from "googleapis";

function calendarClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

// 그 달의 실제 구글 캘린더 일정 목록 (본인 캘린더만 -- 다른 사람 것은 구글 정책상 이 방식으론 못 읽음).
export async function listMonthEvents(accessToken, year, month) {
  const calendar = calendarClient(accessToken);
  const timeMin = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const timeMax = new Date(Date.UTC(year, month, 1)).toISOString();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });
  return (res.data.items || []).map((ev) => ({
    id: ev.id,
    title: ev.summary || "(제목 없음)",
    date: (ev.start?.date || ev.start?.dateTime || "").slice(0, 10),
  }));
}

// date: 'YYYY-MM-DD', time: 'HH:MM' | null
// time이 있으면 1시간짜리 일정, 없으면 종일 일정. 하루전+10분전 팝업 알림 고정.
export async function createEventWithReminder({ accessToken, text, date, time }) {
  const calendar = calendarClient(accessToken);

  const eventBody = {
    summary: text,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 1440 },
        { method: "popup", minutes: 10 },
      ],
    },
  };

  if (time) {
    // 서버(Vercel)는 UTC로 도는데 date/time은 한국 시각이라, 오프셋 없이 new Date()에
    // 넣으면 "15:30"을 UTC 15:30으로 잘못 해석해서 실제로는 한국 시각 다음날 00:30에
    // 생성돼버린다. 반드시 +09:00을 명시해서 올바른 시각으로 고정한다.
    const startISO = `${date}T${time}:00+09:00`;
    const start = new Date(startISO);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    eventBody.start = { dateTime: startISO, timeZone: "Asia/Seoul" };
    eventBody.end = { dateTime: end.toISOString(), timeZone: "Asia/Seoul" };
  } else {
    const [y, m, d] = date.split("-").map(Number);
    const endDate = new Date(Date.UTC(y, m - 1, d + 1));
    eventBody.start = { date };
    eventBody.end = { date: endDate.toISOString().slice(0, 10) };
  }

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventBody,
  });
  return res.data.id;
}

export async function deleteEvent(accessToken, eventId) {
  const calendar = calendarClient(accessToken);
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (err) {
    // 이미 사용자가 구글 캘린더에서 직접 지운 경우(404)는 무시, 그 외엔 알린다.
    if (err?.code !== 404 && err?.response?.status !== 404) {
      throw err;
    }
  }
}
