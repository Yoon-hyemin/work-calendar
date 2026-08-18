import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

// 초대 = members 테이블에 미리 row를 만들어 접근 권한을 부여하는 것.
// 실제 이메일 발송은 아직 붙이지 않았음 -- 관리자가 로그인 링크를 복사해서 직접 전달한다.
export async function POST(req) {
  const session = await requireSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "관리자만 가능합니다." }, { status: 403 });
  }

  const { email: rawEmail, name: rawName } = await req.json();
  const email = (rawEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
  }

  const name = (rawName || "").trim() || email.split("@")[0];

  const existing = await sql`SELECT status FROM members WHERE email = ${email}`;
  if (existing.length > 0) {
    if (existing[0].status === "removed") {
      await sql`UPDATE members SET status = 'active', name = ${name} WHERE email = ${email}`;
    } else {
      return NextResponse.json({ error: "이미 등록된 팀원입니다." }, { status: 400 });
    }
  } else {
    await sql`
      INSERT INTO members (email, name, is_admin, status)
      VALUES (${email}, ${name}, FALSE, 'active')
    `;
  }

  const loginUrl = `${process.env.NEXTAUTH_URL}/login`;
  return NextResponse.json({
    ok: true,
    email,
    name,
    loginUrl,
    message: `${name}(${email})님께 이 링크를 전달해주세요: ${loginUrl} (구글 계정으로 로그인하면 바로 접속됩니다)`,
  });
}
