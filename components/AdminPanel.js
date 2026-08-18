"use client";

import { useEffect, useState, useCallback } from "react";

async function api(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data;
}

export default function AdminPanel({ currentEmail }) {
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [directViewer, setDirectViewer] = useState("");
  const [directTarget, setDirectTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([api("/api/members"), api("/api/shares")]);
    setMembers(m.members);
    setPending(s.pending);
    setApproved(s.approved);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError(null);
    setInviteResult(null);
    try {
      const res = await api("/api/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, name: inviteName }),
      });
      setInviteResult(res);
      setInviteEmail("");
      setInviteName("");
      load();
    } catch (err) {
      setInviteError(err.message);
    }
  }

  async function toggleAdmin(email, isAdmin) {
    setBusy(true);
    try {
      await api(`/api/members/${encodeURIComponent(email)}`, {
        method: "PATCH",
        body: JSON.stringify({ isAdmin: !isAdmin }),
      });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(email) {
    if (!confirm(`${email} 님의 접근 권한을 회수할까요? (작성한 할일 기록은 보존됩니다)`)) return;
    setBusy(true);
    try {
      await api(`/api/members/${encodeURIComponent(email)}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reviewShare(id, action) {
    setBusy(true);
    try {
      await api(`/api/shares/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createDirectShare(e) {
    e.preventDefault();
    if (!directViewer || !directTarget) return;
    setBusy(true);
    try {
      await api("/api/shares/direct", {
        method: "POST",
        body: JSON.stringify({ viewerEmail: directViewer, targetEmail: directTarget }),
      });
      setDirectViewer("");
      setDirectTarget("");
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <section className="bg-card rounded-card shadow-card p-6">
        <h2 className="font-bold text-text-strong mb-4">팀원 초대하기</h2>
        <form onSubmit={handleInvite} className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="이메일"
            className="flex-1 min-w-[180px] rounded-[9px] border border-border px-3 py-2 text-sm outline-none focus:border-point"
          />
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="이름 (선택)"
            className="w-32 rounded-[9px] border border-border px-3 py-2 text-sm outline-none focus:border-point"
          />
          <button
            type="submit"
            className="rounded-[9px] bg-point hover:bg-point-hover text-white px-4 py-2 text-sm font-medium"
          >
            초대
          </button>
        </form>
        {inviteError && <p className="text-danger text-sm mt-2">{inviteError}</p>}
        {inviteResult && (
          <div className="mt-3 rounded-lg border border-success bg-success-bg text-success text-sm px-4 py-3">
            {inviteResult.message}
          </div>
        )}
      </section>

      <section className="bg-card rounded-card shadow-card p-6">
        <h2 className="font-bold text-text-strong mb-4">팀원 관리</h2>
        <div className="flex flex-col gap-2">
          {activeMembers.map((m) => (
            <div key={m.email} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <div className="text-sm font-medium text-text-strong">{m.name}</div>
                <div className="text-xs text-text-muted">{m.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    m.isAdmin ? "bg-success-bg text-success" : "bg-tab-bg text-text-muted"
                  }`}
                >
                  {m.isAdmin ? "관리자" : "팀원"}
                </span>
                {m.email !== currentEmail && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => toggleAdmin(m.email, m.isAdmin)}
                      className="text-xs rounded-[8px] border border-border px-2 py-1 hover:bg-bg"
                    >
                      {m.isAdmin ? "관리자 해제" : "관리자 지정"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => removeMember(m.email)}
                      className="text-xs rounded-[8px] border border-danger-border text-danger px-2 py-1 hover:bg-danger-bg"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card rounded-card shadow-card p-6">
        <h2 className="font-bold text-text-strong mb-4">대기 중인 공유 요청</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-text-muted">대기 중인 요청이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <span>
                  <b>{s.viewerName}</b>님이 <b>{s.targetName}</b>님의 캘린더를 보고 싶어합니다
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => reviewShare(s.id, "approve")}
                    className="text-xs rounded-[8px] bg-point text-white px-3 py-1"
                  >
                    승인
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => reviewShare(s.id, "reject")}
                    className="text-xs rounded-[8px] border border-border px-3 py-1"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card rounded-card shadow-card p-6">
        <h2 className="font-bold text-text-strong mb-4">승인된 공유 목록</h2>
        {approved.length === 0 ? (
          <p className="text-sm text-text-muted">승인된 공유가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {approved.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <span>
                  <b>{s.viewerName}</b> → <b>{s.targetName}</b>
                </span>
                <button
                  disabled={busy}
                  onClick={() => reviewShare(s.id, "revoke")}
                  className="text-xs rounded-[8px] border border-danger-border text-danger px-3 py-1"
                >
                  해제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card rounded-card shadow-card p-6">
        <h2 className="font-bold text-text-strong mb-4">새 공유 요청 만들기 (바로 연결하기)</h2>
        <form onSubmit={createDirectShare} className="flex flex-wrap items-center gap-2">
          <select
            value={directViewer}
            onChange={(e) => setDirectViewer(e.target.value)}
            className="rounded-[9px] border border-border px-3 py-2 text-sm"
          >
            <option value="">보는 사람 선택</option>
            {activeMembers.map((m) => (
              <option key={m.email} value={m.email}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="text-text-muted text-sm">→</span>
          <select
            value={directTarget}
            onChange={(e) => setDirectTarget(e.target.value)}
            className="rounded-[9px] border border-border px-3 py-2 text-sm"
          >
            <option value="">대상 캘린더 선택</option>
            {activeMembers.map((m) => (
              <option key={m.email} value={m.email}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-[9px] bg-point hover:bg-point-hover text-white px-4 py-2 text-sm font-medium"
          >
            바로 연결
          </button>
        </form>
      </section>
    </div>
  );
}
