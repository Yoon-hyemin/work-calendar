import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";

// action: 'approve' | 'reject' | 'revoke' -- 전부 관리자 전용.
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "관리자만 가능합니다." }, { status: 403 });
  }
  const id = Number(params.id);
  const { action } = await req.json();

  if (action === "approve") {
    await sql`UPDATE shares SET status = 'approved' WHERE id = ${id}`;
  } else if (action === "reject" || action === "revoke") {
    await sql`DELETE FROM shares WHERE id = ${id}`;
  } else {
    return NextResponse.json({ error: "알 수 없는 처리입니다." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
