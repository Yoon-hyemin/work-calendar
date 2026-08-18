"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { sortByTime } from "@/lib/dateUtils";

export default function DayDetailModal({
  date,
  tasks,
  googleEvents,
  readOnly,
  viewingEmail,
  onToggle,
  onDelete,
  onAdd,
  onEdit,
  onClose,
}) {
  const [memo, setMemo] = useState("");
  const [savedMemo, setSavedMemo] = useState("");
  const [memoLoading, setMemoLoading] = useState(true);
  const [memoSaving, setMemoSaving] = useState(false);
  const [text, setText] = useState("");
  const [remind, setRemind] = useState(false);
  const [time, setTime] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editRemind, setEditRemind] = useState(false);
  const [editTime, setEditTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const loadMemo = useCallback(async () => {
    setMemoLoading(true);
    try {
      const res = await api(
        `/api/day-notes?targetEmail=${encodeURIComponent(viewingEmail)}&date=${date}`
      );
      setMemo(res.memo || "");
      setSavedMemo(res.memo || "");
    } catch {
      setMemo("");
      setSavedMemo("");
    } finally {
      setMemoLoading(false);
    }
  }, [viewingEmail, date]);

  useEffect(() => {
    loadMemo();
  }, [loadMemo]);

  async function saveMemo() {
    setMemoSaving(true);
    try {
      await api("/api/day-notes", { method: "PUT", body: JSON.stringify({ date, memo }) });
      setSavedMemo(memo);
    } catch (err) {
      alert(err.message);
    } finally {
      setMemoSaving(false);
    }
  }

  async function submitAdd() {
    if (!text.trim() || addSaving) return;
    setAddSaving(true);
    await onAdd(date, text.trim(), remind, remind ? time || null : null);
    setText("");
    setRemind(false);
    setTime("");
    setAddSaving(false);
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditText(t.text);
    setEditRemind(!!(t.time || t.calendarEventId));
    setEditTime(t.time || "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function submitEdit(id) {
    if (!editText.trim() || editSaving) return;
    setEditSaving(true);
    await onEdit(id, editText.trim(), editRemind, editRemind ? editTime || null : null);
    setEditSaving(false);
    setEditingId(null);
  }

  const sortedEvents = sortByTime(googleEvents);
  const sortedTasks = sortByTime(tasks);

  const [, m, d] = date.split("-").map(Number);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-card shadow-card p-6 w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-text-strong">
            {m}월 {d}일
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-strong">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          {sortedEvents.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 text-sm text-text-muted">
              <span className="text-gcal shrink-0">●</span>
              {ev.time && <span className="shrink-0 text-gcal font-medium">{ev.time}</span>}
              <span className="break-words">{ev.title}</span>
            </div>
          ))}

          {tasks.length === 0 && googleEvents.length === 0 && (
            <p className="text-sm text-text-muted">기록된 할일이 없습니다.</p>
          )}

          {sortedTasks.map((t) =>
            editingId === t.id ? (
              <div key={t.id} className="flex flex-col gap-1.5 bg-bg rounded-lg p-2.5">
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitEdit(t.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="text-sm rounded border border-border px-2.5 py-1.5 outline-none focus:border-point"
                />
                <label className="flex items-center gap-1 text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={editRemind}
                    onChange={(e) => setEditRemind(e.target.checked)}
                    className="accent-point"
                  />
                  📅 알림
                </label>
                {editRemind && (
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="text-xs rounded border border-border px-2 py-1 w-fit"
                  />
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => submitEdit(t.id)}
                    disabled={editSaving}
                    className="text-xs bg-point hover:bg-point-hover text-white rounded px-3 py-1.5 disabled:opacity-50"
                  >
                    {editSaving ? "저장중" : "저장"}
                  </button>
                  <button onClick={cancelEdit} className="text-xs text-text-muted px-3 py-1.5">
                    취소
                  </button>
                </div>
              </div>
            ) : readOnly ? (
              <div key={t.id} className="flex items-start gap-2 text-sm text-text-body">
                <span>{t.done ? "✓" : "·"}</span>
                {t.time && <span className="shrink-0 text-text-muted">{t.time}</span>}
                <span className={`break-words ${t.done ? "line-through text-text-disabled" : ""}`}>
                  {t.text}
                </span>
              </div>
            ) : (
              <div key={t.id} className="flex items-start gap-2 text-sm group">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={(e) => onToggle(t.id, e.target.checked)}
                  className="accent-point shrink-0 mt-0.5"
                />
                {t.time && <span className="shrink-0 text-text-muted mt-0.5">{t.time}</span>}
                <span
                  className={`break-words flex-1 ${
                    t.done ? "line-through text-text-disabled" : "text-text-body"
                  }`}
                >
                  {t.text}
                </span>
                <button
                  onClick={() => startEdit(t)}
                  className="text-text-disabled hover:text-point shrink-0"
                  title="수정"
                >
                  ✎
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-text-disabled hover:text-danger shrink-0"
                >
                  ×
                </button>
              </div>
            )
          )}

          {!readOnly && (
            <div className="flex flex-col gap-1.5 mt-1 bg-bg rounded-lg p-2.5">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAdd();
                }}
                placeholder="할일 입력"
                className="text-sm rounded border border-border px-2.5 py-1.5 outline-none focus:border-point"
              />
              <label className="flex items-center gap-1 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={remind}
                  onChange={(e) => setRemind(e.target.checked)}
                  className="accent-point"
                />
                📅 알림
              </label>
              {remind && (
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="text-xs rounded border border-border px-2 py-1 w-fit"
                />
              )}
              <button
                onClick={submitAdd}
                disabled={addSaving}
                className="text-xs bg-point hover:bg-point-hover text-white rounded px-3 py-1.5 self-start disabled:opacity-50"
              >
                {addSaving ? "저장중" : "+ 할일 추가"}
              </button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-text-muted mb-1.5">📝 메모</p>
            {memoLoading ? (
              <p className="text-xs text-text-disabled">불러오는 중...</p>
            ) : readOnly ? (
              memo ? (
                <p className="text-sm text-text-body whitespace-pre-wrap">{memo}</p>
              ) : (
                <p className="text-xs text-text-disabled">작성된 메모가 없습니다.</p>
              )
            ) : (
              <>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="오늘 하루 메모나 피드백을 남겨보세요"
                  rows={3}
                  className="w-full text-sm rounded-lg border border-border px-3 py-2 outline-none focus:border-point resize-none"
                />
                <button
                  onClick={saveMemo}
                  disabled={memoSaving || memo === savedMemo}
                  className="mt-2 text-xs bg-point hover:bg-point-hover text-white rounded px-3 py-1.5 disabled:opacity-50"
                >
                  {memoSaving ? "저장중" : "메모 저장"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
