"use client";

import { useState } from "react";
import { sortByTime } from "@/lib/dateUtils";

export default function DayCell({
  cell,
  tasks,
  googleEvents,
  isToday,
  readOnly,
  onToggle,
  onDelete,
  onAdd,
  onExpand,
  onMove,
  onReorder,
  onContextMenu,
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [remind, setRemind] = useState(false);
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const canDrop = cell.inMonth && !readOnly;

  function handleDragEnter(e) {
    if (!canDrop) return;
    e.preventDefault();
    setDragOver(true);
  }
  function handleDragOver(e) {
    if (!canDrop) return;
    e.preventDefault();
  }
  function handleDragLeave() {
    setDragOver(false);
  }
  function handleDrop(e) {
    if (!canDrop) return;
    e.preventDefault();
    setDragOver(false);
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (id) onMove(id, cell.date);
  }

  const dow = new Date(cell.date + "T00:00:00").getDay();
  const dowColor = dow === 0 ? "text-sunday" : dow === 6 ? "text-saturday" : "text-text-strong";
  const numberColor = !cell.inMonth ? "text-text-disabled" : dowColor;

  const sortedEvents = sortByTime(googleEvents || []);
  const sortedTasks = sortByTime(tasks);

  async function submitAdd() {
    if (!text.trim() || saving) return;
    setSaving(true);
    await onAdd(cell.date, text.trim(), remind, remind ? time || null : null);
    setText("");
    setRemind(false);
    setTime("");
    setAdding(false);
    setSaving(false);
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-h-[110px] rounded-card p-2 flex flex-col gap-1 ${
        isToday ? "bg-[#EAF2FF]" : "bg-card"
      } ${!cell.inMonth ? "opacity-50" : ""} ${
        dragOver ? "ring-2 ring-point" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`text-xs font-semibold ${numberColor}`}>{cell.day}</div>
        {cell.inMonth && (
          <button
            onClick={() => onExpand(cell.date)}
            title="크게 보기"
            className="text-text-disabled hover:text-point text-xs leading-none"
          >
            ⤢
          </button>
        )}
      </div>

      {cell.inMonth && (
        <div className="flex flex-col gap-1 flex-1">
          {sortedEvents.map((ev) => (
            <div key={ev.id} className="flex items-center gap-1 text-[11px] text-text-muted truncate">
              <span className="text-gcal shrink-0">●</span>
              {ev.time && <span className="shrink-0 text-gcal font-medium">{ev.time}</span>}
              <span className="truncate">{ev.title}</span>
            </div>
          ))}

          {sortedTasks.map((t) =>
            readOnly ? (
              <div key={t.id} className="flex items-start gap-1 text-[11px] text-text-body">
                <span>{t.done ? "✓" : "·"}</span>
                {t.time && <span className="shrink-0 text-text-muted">{t.time}</span>}
                <span className={`break-words ${t.done ? "line-through text-text-disabled" : ""}`}>
                  {t.text}
                </span>
              </div>
            ) : (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(t.id));
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextMenu(e, t);
                }}
                onDragOver={(e) => {
                  if (!canDrop) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!canDrop) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  const movedId = Number(e.dataTransfer.getData("text/plain"));
                  if (movedId && movedId !== t.id) onReorder(movedId, cell.date, t.id);
                }}
                className="flex items-start gap-1 text-[11px] group cursor-grab active:cursor-grabbing select-none"
              >
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
                  onClick={() => onDelete(t.id)}
                  className="text-text-disabled hover:text-danger shrink-0 opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            )
          )}

          {!readOnly &&
            (adding ? (
              <div className="flex flex-col gap-1 mt-1 bg-bg rounded-lg p-1.5">
                <input
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitAdd();
                    if (e.key === "Escape") setAdding(false);
                  }}
                  placeholder="할일 입력"
                  className="text-[11px] rounded border border-border px-1.5 py-1 outline-none focus:border-point"
                />
                <label className="flex items-center gap-1 text-[10px] text-text-muted">
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
                    className="text-[10px] rounded border border-border px-1 py-0.5"
                  />
                )}
                <div className="flex gap-1">
                  <button
                    onClick={submitAdd}
                    disabled={saving}
                    className="text-[10px] bg-point text-white rounded px-2 py-0.5 disabled:opacity-50"
                  >
                    {saving ? "저장중" : "저장"}
                  </button>
                  <button
                    onClick={() => setAdding(false)}
                    className="text-[10px] text-text-muted px-2 py-0.5"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="text-[11px] text-text-muted hover:text-point text-left mt-auto"
              >
                + 추가
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
