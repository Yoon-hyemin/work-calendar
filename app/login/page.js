"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES = {
  AccessDenied: "초대받지 않은 계정입니다. 관리자에게 문의해주세요.",
};

function LoginCard() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorMessage = error ? ERROR_MESSAGES[error] || "로그인 중 문제가 발생했습니다." : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card rounded-card shadow-card p-8 text-center">
        <div className="text-4xl mb-3">📅</div>
        <h1 className="text-xl font-bold text-text-strong mb-1">업무 캘린더</h1>
        <p className="text-sm text-text-muted mb-8">구글 계정으로 로그인해주세요</p>

        {errorMessage && (
          <div className="mb-5 rounded-lg border border-danger-border bg-danger-bg text-danger text-sm px-4 py-3 text-left">
            {errorMessage}
          </div>
        )}

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full rounded-[10px] bg-point hover:bg-point-hover text-white font-medium py-3 transition-colors"
        >
          Google로 로그인
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  );
}
