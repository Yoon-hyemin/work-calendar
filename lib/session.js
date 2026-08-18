import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// API 라우트에서 로그인한 사용자 정보를 가져오는 공통 헬퍼.
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session;
}
