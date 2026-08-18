export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function ymd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// 이전/다음달 채움 셀 포함 6주 그리드. inMonth=false는 회색 처리 + 클릭(할일 추가) 불가.
export function buildMonthGrid(year, month) {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=일요일
  const totalDays = daysInMonth(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevTotalDays = daysInMonth(prevYear, prevMonth);

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevTotalDays - i;
    cells.push({ date: ymd(prevYear, prevMonth, d), day: d, inMonth: false });
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ date: ymd(year, month, d), day: d, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 35) {
    cells.push({ date: ymd(nextYear, nextMonth, nextDay), day: nextDay, inMonth: false });
    nextDay += 1;
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function todayYmd() {
  const now = new Date();
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function monthLabel(year, month) {
  return `${year}년 ${month}월`;
}

// 시간 있는 항목을 먼저(시간순), 시간 없는 항목은 뒤에 원래 순서 그대로.
export function sortByTime(items) {
  return [...items].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
}
