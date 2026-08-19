"use client";

export default function TaskContextMenu({ x, y, onRepeat, onClose }) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 bg-card rounded-lg shadow-card border border-border py-1 text-sm min-w-[160px]"
        style={{ top: y, left: x }}
      >
        <button
          onClick={onRepeat}
          className="block w-full text-left px-4 py-2 hover:bg-bg text-text-body"
        >
          🔁 반복 설정
        </button>
      </div>
    </>
  );
}
