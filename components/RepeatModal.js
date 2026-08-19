"use client";

import { useState } from "react";

function defaultEndDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function RepeatModal({ task, onSubmit, onClose }) {
  const [mode, setMode] = useState("until");
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    await onSubmit(mode === "infinite" ? null : endDate);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-card shadow-card p-6 w-full max-w-sm">
        <h2 className="font-bold text-text-strong mb-1">매일 반복 설정</h2>
        <p className="text-sm text-text-muted mb-4 break-words">"{task.text}"</p>

        <div className="flex flex-col gap-2 mb-5">
          <label className="flex items-center gap-2 text-sm text-text-body">
            <input
              type="radio"
              checked={mode === "until"}
              onChange={() => setMode("until")}
              className="accent-point"
            />
            종료일 지정
          </label>
          {mode === "until" && (
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="ml-6 rounded-[9px] border border-border px-3 py-2 text-sm w-fit"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-text-body">
            <input
              type="radio"
              checked={mode === "infinite"}
              onChange={() => setMode("infinite")}
              className="accent-point"
            />
            무한 반복
          </label>
          {mode === "infinite" && (
            <p className="ml-6 text-xs text-text-muted">
              한 번에 1년치를 미리 만들어둬요. 그 이후에도 계속하려면 그때 다시 설정해주세요.
            </p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm text-text-muted px-4 py-2">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || (mode === "until" && !endDate)}
            className="rounded-[9px] bg-point hover:bg-point-hover text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "만드는 중..." : "반복 만들기"}
          </button>
        </div>
      </div>
    </div>
  );
}
