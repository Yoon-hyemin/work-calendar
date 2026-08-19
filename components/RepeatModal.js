"use client";

import { useState } from "react";

const FREQUENCIES = [
  { value: "daily", label: "매일" },
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "yearly", label: "연 1회" },
];

const INFINITE_HINT = {
  daily: "1년치",
  weekly: "1년치",
  monthly: "2년치",
  yearly: "10년치",
};

function defaultEndDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function RepeatModal({ task, onSubmit, onClose }) {
  const [frequency, setFrequency] = useState("daily");
  const [mode, setMode] = useState("until");
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    await onSubmit(frequency, mode === "infinite" ? null : endDate);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-card shadow-card p-6 w-full max-w-sm">
        <h2 className="font-bold text-text-strong mb-1">반복 설정</h2>
        <p className="text-sm text-text-muted mb-4 break-words">"{task.text}"</p>

        <div className="flex flex-col gap-1.5 mb-5">
          <p className="text-xs font-semibold text-text-muted mb-1">반복 주기</p>
          <div className="flex gap-1.5 flex-wrap">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                onClick={() => setFrequency(f.value)}
                className={`text-sm rounded-full px-3 py-1.5 border ${
                  frequency === f.value
                    ? "bg-point text-white border-point"
                    : "border-border text-text-body hover:bg-bg"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

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
              한 번에 {INFINITE_HINT[frequency]}를 미리 만들어둬요. 그 이후에도 계속하려면 그때 다시
              설정해주세요.
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
