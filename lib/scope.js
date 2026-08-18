import { sql } from "@/lib/db";

// viewer가 target의 캘린더를 볼 수 있는가.
// 본인이거나, 관리자이거나, target이 viewer에게 공유를 승인해준 경우만 true.
export async function canView(viewerEmail, targetEmail, viewerIsAdmin) {
  if (viewerEmail === targetEmail) return true;
  if (viewerIsAdmin) return true;
  const rows = await sql`
    SELECT 1 FROM shares
    WHERE viewer_email = ${viewerEmail}
      AND target_email = ${targetEmail}
      AND status = 'approved'
    LIMIT 1
  `;
  return rows.length > 0;
}
