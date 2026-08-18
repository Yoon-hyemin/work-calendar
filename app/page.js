"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { buildMonthGrid, todayYmd, monthLabel } from "@/lib/dateUtils";
import { api } from "@/lib/apiClient";
import DayCell from "@/components/DayCell";
import AdminPanel from "@/components/AdminPanel";
import DayDetailModal from "@/components/DayDetailModal";

const YEAR_RANGE = (() => {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1];
})();

export default function HomePage() {
  const { data: session, status } = useSession();

  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewingEmail, setViewingEmail] = useState(null);
  const [members, setMembers] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [myShares, setMyShares] = useState({ pending: [], approved: [] });
  const [tasks, setTasks] = useState([]);
  const [readOnly, setReadOnly] = useState(false);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleError, setGoogleError] = useState(null);
  const [tab, setTab] = useState("calendar");
  const [shareTarget, setShareTarget] = useState("");
  const [reportText, setReportText] = useState(null);
  const [copyLabel, setCopyLabel] = useState("복사");
  const [expandedDate, setExpandedDate] = useState(null);

  const selfEmail = session?.user?.email;
  const isAdmin = !!session?.user?.isAdmin;

  useEffect(() => {
    if (selfEmail && !viewingEmail) setViewingEmail(selfEmail);
  }, [selfEmail, viewingEmail]);

  const loadMembers = useCallback(async () => {
    const res = await api("/api/members");
    setMembers(res.members);
  }, []);

  const loadDirectoryAndShares = useCallback(async () => {
    if (isAdmin) return;
    const [dir, shares] = await Promise.all([api("/api/members/directory"), api("/api/shares")]);
    setDirectory(dir.members);
    setMyShares(shares);
  }, [isAdmin]);

  const loadTasks = useCallback(async () => {
    if (!viewingEmail) return;
    const res = await api(
      `/api/tasks?targetEmail=${encodeURIComponent(viewingEmail)}&year=${year}&month=${month}`
    );
    setTasks(res.tasks);
    setReadOnly(res.readOnly);
  }, [viewingEmail, year, month]);

  const loadGoogleEvents = useCallback(async () => {
    if (!viewingEmail) return;
    const res = await api(
      `/api/calendar-events?targetEmail=${encodeURIComponent(viewingEmail)}&year=${year}&month=${month}`
    );
    setGoogleEvents(res.events || []);
    setGoogleError(res.error || null);
  }, [viewingEmail, year, month]);

  useEffect(() => {
    if (session) {
      loadMembers();
      loadDirectoryAndShares();
    }
  }, [session, loadMembers, loadDirectoryAndShares]);

  useEffect(() => {
    if (session) {
      loadTasks();
      loadGoogleEvents();
    }
  }, [session, loadTasks, loadGoogleEvents]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-text-muted">불러오는 중...</div>;
  }
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button
          onClick={() => signIn("google")}
          className="rounded-[10px] bg-point text-white px-5 py-3 font-medium"
        >
          Google로 로그인
        </button>
      </div>
    );
  }

  const grid = buildMonthGrid(year, month);
  const today = todayYmd();
  const tasksByDate = {};
  for (const t of tasks) {
    (tasksByDate[t.date] ||= []).push(t);
  }
  const eventsByDate = {};
  for (const ev of googleEvents) {
    (eventsByDate[ev.date] ||= []).push(ev);
  }

  const daysWithTasks = Object.keys(tasksByDate).length;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;
  const percent = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  function goPrevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function goNextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }
  function goToday() {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth() + 1);
  }

  async function handleToggle(id, done) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    try {
      await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done }) });
    } catch (err) {
      alert(err.message);
      loadTasks();
    }
  }

  async function handleDelete(id) {
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await api(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.calendarError) alert(res.calendarError);
    } catch (err) {
      alert(err.message);
      setTasks(prevTasks);
    }
  }

  async function handleAdd(date, text, remind, time) {
    const tempId = `temp-${Date.now()}`;
    setTasks((prev) => [...prev, { id: tempId, date, text, done: false, calendarEventId: null }]);
    try {
      const res = await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ date, text, remind, time }),
      });
      setTasks((prev) => prev.map((t) => (t.id === tempId ? res.task : t)));
      if (res.calendarError) alert(res.calendarError);
      if (remind) loadGoogleEvents();
    } catch (err) {
      alert(err.message);
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  }

  async function handleEdit(id, text, remind, time) {
    const prevTasks = tasks;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    try {
      const res = await api(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ text, time, remind }),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? res.task : t)));
      if (res.calendarError) alert(res.calendarError);
      loadGoogleEvents();
    } catch (err) {
      alert(err.message);
      setTasks(prevTasks);
    }
  }

  async function requestShare() {
    if (!shareTarget) return;
    try {
      await api("/api/shares", { method: "POST", body: JSON.stringify({ targetEmail: shareTarget }) });
      setShareTarget("");
      loadDirectoryAndShares();
      alert("공유 요청을 보냈습니다. 관리자 승인을 기다려주세요.");
    } catch (err) {
      alert(err.message);
    }
  }

  function buildReportText(notesByDate) {
    const lines = [];
    lines.push(`${monthLabel(year, month)} 업무 리포트`);
    lines.push("");
    lines.push(`총 근무일: ${daysWithTasks}일`);
    lines.push(`총 업무: ${totalTasks}건`);
    lines.push(`완료율: ${percent}% (${doneTasks}/${totalTasks})`);
    lines.push("");
    const allDates = new Set([...Object.keys(tasksByDate), ...Object.keys(notesByDate)]);
    const sortedDates = Array.from(allDates).sort();
    for (const d of sortedDates) {
      const day = Number(d.slice(8, 10));
      lines.push(`${month}월 ${day}일`);
      for (const t of tasksByDate[d] || []) {
        lines.push(`  - ${t.done ? "☑" : "☐"} ${t.text}`);
      }
      if (notesByDate[d]) {
        lines.push(`  📝 메모: ${notesByDate[d]}`);
      }
    }
    return lines.join("\n");
  }

  async function openReport() {
    let notes = {};
    try {
      const res = await api(
        `/api/day-notes?targetEmail=${encodeURIComponent(viewingEmail)}&year=${year}&month=${month}`
      );
      notes = res.notes || {};
    } catch {
      // 메모를 못 불러와도 리포트 자체는 그대로 보여준다
    }
    setReportText(buildReportText(notes));
    setCopyLabel("복사");
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText || "");
      setCopyLabel("복사됨!");
      setTimeout(() => setCopyLabel("복사"), 1500);
    } catch {
      setCopyLabel("복사 실패");
    }
  }

  const alreadyConnectedEmails = new Set([
    selfEmail,
    ...myShares.pending.map((s) => s.targetEmail),
    ...myShares.approved.map((s) => s.targetEmail),
  ]);
  const shareCandidates = directory.filter((m) => !alreadyConnectedEmails.has(m.email));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-lg font-bold text-text-strong flex items-center gap-2">
          📅 업무 캘린더
        </h1>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span>{session.user.name}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="hover:text-point">
            로그아웃
          </button>
        </div>
      </header>

      {isAdmin && (
        <div className="inline-flex bg-tab-bg rounded-full p-1 mb-6">
          {[
            ["calendar", "캘린더"],
            ["admin", "관리자 설정"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === key ? "bg-white shadow-card text-text-strong" : "text-text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "admin" ? (
        <AdminPanel currentEmail={selfEmail} />
      ) : (
        <>
          <div className="bg-card rounded-card shadow-card p-4 mb-4 flex flex-wrap items-center gap-3">
            <select
              value={viewingEmail || ""}
              onChange={(e) => setViewingEmail(e.target.value)}
              className="rounded-[9px] border border-border px-3 py-2 text-sm"
            >
              {members.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.email === selfEmail ? `내 캘린더 (${m.name})` : `${m.name} 캘린더`}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button onClick={goPrevMonth} className="w-8 h-8 rounded-full border border-border hover:bg-bg">
                ‹
              </button>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-[9px] border border-border px-2 py-2 text-sm"
              >
                {YEAR_RANGE.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-[9px] border border-border px-2 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
              <button onClick={goNextMonth} className="w-8 h-8 rounded-full border border-border hover:bg-bg">
                ›
              </button>
              <button
                onClick={goToday}
                className="rounded-[9px] border border-border px-3 py-2 text-sm hover:bg-bg"
              >
                오늘
              </button>
            </div>

            <button
              onClick={openReport}
              className="ml-auto rounded-[9px] bg-point hover:bg-point-hover text-white px-4 py-2 text-sm font-medium"
            >
              리포트 생성
            </button>
          </div>

          {!isAdmin && (
            <div className="bg-card rounded-card shadow-card p-4 mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-text-muted">다른 팀원 캘린더가 보고 싶으신가요?</span>
              <select
                value={shareTarget}
                onChange={(e) => setShareTarget(e.target.value)}
                className="rounded-[9px] border border-border px-3 py-2 text-sm"
              >
                <option value="">팀원 선택</option>
                {shareCandidates.map((m) => (
                  <option key={m.email} value={m.email}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                onClick={requestShare}
                disabled={!shareTarget}
                className="rounded-[9px] border border-border px-3 py-2 text-sm hover:bg-bg disabled:opacity-50"
              >
                공유 요청 보내기
              </button>
              {myShares.pending.length > 0 && (
                <span className="text-xs text-pending bg-pending-bg rounded-full px-3 py-1">
                  대기중: {myShares.pending.map((s) => s.targetName).join(", ")}
                </span>
              )}
            </div>
          )}

          <p className="text-sm text-text-muted mb-3">
            {daysWithTasks}일 기록 · {totalTasks}건 중 {doneTasks}건 완료 ({percent}%)
          </p>
          {googleError && <p className="text-xs text-danger mb-3">{googleError}</p>}

          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold">
            {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
              <div key={d} className={i === 0 ? "text-sunday" : i === 6 ? "text-saturday" : "text-text-muted"}>
                {d}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {grid.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-2">
                {week.map((cell) => (
                  <DayCell
                    key={cell.date}
                    cell={cell}
                    tasks={tasksByDate[cell.date] || []}
                    googleEvents={eventsByDate[cell.date] || []}
                    isToday={cell.date === today}
                    readOnly={readOnly}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onAdd={handleAdd}
                    onExpand={setExpandedDate}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {expandedDate && (
        <DayDetailModal
          date={expandedDate}
          tasks={tasksByDate[expandedDate] || []}
          googleEvents={eventsByDate[expandedDate] || []}
          readOnly={readOnly}
          viewingEmail={viewingEmail}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onClose={() => setExpandedDate(null)}
        />
      )}

      {reportText && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-card shadow-card p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-text-strong">업무 리포트</h2>
              <button onClick={() => setReportText(null)} className="text-text-muted hover:text-text-strong">
                ✕
              </button>
            </div>
            <pre className="text-sm whitespace-pre-wrap overflow-y-auto flex-1 bg-bg rounded-lg p-4">
              {reportText}
            </pre>
            <button
              onClick={copyReport}
              className="mt-4 rounded-[9px] bg-point hover:bg-point-hover text-white px-4 py-2 text-sm font-medium self-end"
            >
              {copyLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
