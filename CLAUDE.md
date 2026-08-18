# 업무 캘린더 앱 — 프로젝트 메모

Google Apps Script + 구글 시트로 만들었던 "업무 캘린더"를 GitHub + Vercel + Neon Postgres 기반으로 재구축하는 프로젝트. 이 폴더는 SelfDIYLab HR 프로젝트(`../인사 에이전트`)와 완전히 별개다 — 다른 회사, 다른 관리자, 다른 용도.

## 사용자 정보

- 관리자(팀장) 계정: yhmj102@gmail.com (개인 Gmail)
- 팀원 예시: 혜민, 아영, 지영 / 테스트 계정: frencher46@gmail.com
- 사용자는 비개발자 — 클릭 순서/화면 캡처/명확한 에러 메시지로 안내할 것

## 기술 스택

- Next.js 14 (App Router, JavaScript, `next dev -p 3001`로 로컬 실행 — HR 프로젝트가 3000 포트를 씀)
- DB: Neon Postgres (`@neondatabase/serverless`)
- 인증: NextAuth(next-auth v4) Google Provider — 초대된 이메일만 로그인 허용
- 구글 캘린더 연동: `googleapis` 패키지, NextAuth가 발급한 access token 재사용

## 로컬 실행

1. `.env.local.example`을 참고해 `.env.local` 채우기 (`DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`)
2. `npm install`
3. `node scripts/run-sql.js sql/001_init.sql` (최초 1회, 테이블 생성)
4. `npm run dev` (포트 3001)

Claude Code 세션에서는 인사 에이전트 워크트리의 `.claude/launch.json`에 `work-calendar-dev` 설정이 추가돼 있어서(`npm --prefix <이 폴더 경로> run dev -- -p 3001`), preview 도구로 이름만 지정하면 자동 실행된다.

## 로그인 / 권한 모델

- **로그인 게이트**: 아무 구글 계정이나 되는 게 아니다. `members` 테이블에 미리 row가 있어야(=관리자가 초대해야) 로그인이 성공한다. 유일한 예외는 `ADMIN_EMAIL` 환경변수에 지정된 이메일 — 이 사람은 members row가 없어도 최초 로그인 시 자동으로 관리자로 생성된다(`lib/auth.js`의 `signIn` 콜백).
  - 원래 스펙 문서엔 "구글 계정으로 로그인하면 자동 등록"이라 적혀 있었지만, 그대로 구현하면 아무 구글 계정이나 로그인해서 접근할 수 있는 열린 문이 된다 — Apps Script 버전은 "구글 시트 편집 권한"이 실질적인 게이트였고 그게 이 신버전에선 "초대(=members row 존재)"로 치환된 것이라고 해석해서 이렇게 구현했다.
- **접근 회수(삭제)**: `members.status`를 `'removed'`로만 바꾸고 실제로 행을 지우지 않는다 — tasks/shares가 FK로 email을 참조하고 있어서, 물리 삭제하면 그 사람의 기록이 다 날아가거나 FK 에러가 난다. "팀원 목록에서 제거"는 UI 필터링(활성 멤버만 노출)으로 구현했다.
- **마지막 관리자 보호**: 스펙에는 없지만 추가했다 — 마지막 남은 관리자를 강등/제거하면 아무도 관리자 화면에 못 들어가는 lockout 상태가 되므로 (`app/api/members/[email]/route.js`의 `activeAdminCountExcluding`).
- **팀원 초대**: 이메일 발송 기능은 아직 없다 — `/api/invite`가 members row를 만들고 로그인 링크 문구를 화면에 보여주면, 관리자가 그걸 복사해서 직접 전달해야 한다. 실제 메일 발송을 붙이려면 Resend 등 트랜잭션 이메일 서비스 계정이 추가로 필요해서 v1 범위에서 일부러 뺐다.

## 구글 캘린더 연동

- `lib/googleCalendar.js`: 읽기(`listMonthEvents`, 본인 캘린더만)/쓰기(`createEventWithReminder`, 하루전+10분전 팝업 알림 고정)/삭제(`deleteEvent`).
- 토큰: NextAuth Google Provider를 `access_type=offline, prompt=consent`로 설정해서 매 로그인마다 refresh_token을 받는다 — 로그인할 때마다 동의 화면이 다시 뜨는 건 트레이드오프. `lib/auth.js`의 `jwt` 콜백에서 만료 임박 시 자동 갱신.
- 캘린더 API 호출이 실패해도 할일 저장 자체는 항상 성공시키고, 에러 메시지는 API 응답의 `calendarError` 필드로 프론트에 그대로 노출한다(alert) — Apps Script 버전에서 이 에러를 조용히 삼켜서 디버깅이 힘들었던 전례 때문에 절대 삼키지 않기로 함.

## 데이터 모델 (`sql/001_init.sql`)

- `members(email PK, name, is_admin, status, created_at)` — status: active | removed
- `tasks(id, email FK, date, text, done, calendar_event_id, created_at)` — date는 진짜 DATE 컬럼(Apps Script의 'D2026-8-17' 문자열 꼼수 불필요)
- `shares(id, viewer_email FK, target_email FK, status, created_at)` — status: pending | approved. `canView(viewer, target)`: 본인이거나, 관리자거나, `viewer_email=viewer AND target_email=target AND status='approved'`인 행이 있으면 true (`lib/scope.js`)

## 배포 전 아직 안 한 것 (다음 세션 체크리스트)

1. Google Cloud Console에서 OAuth 클라이언트 발급 + Calendar API 활성화 (사용자가 직접)
2. Neon 프로젝트 생성 + `DATABASE_URL` 발급 (사용자가 직접, 또는 Claude가 브라우저로 안내)
3. `.env.local`에 실제 값 채우고 `node scripts/run-sql.js sql/001_init.sql` 실행, 로컬에서 실제 계정으로 로그인 테스트
4. GitHub 저장소(`work-calendar`) 생성 + push
5. Vercel 프로젝트 연결 + 환경변수 등록(`DATABASE_URL`, `NEXTAUTH_URL`=실제 배포 URL, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`) + 배포
6. Google Cloud Console의 OAuth 클라이언트에 Vercel 배포 URL을 승인된 리디렉션 URI로 추가 (`https://<배포도메인>/api/auth/callback/google`)
7. frencher46@gmail.com 같은 테스트 계정으로 초대 → 로그인 → 캘린더 사용 실제 테스트

## npm 패키지 보안 메모

`npm audit` 기준 next/googleapis 관련 취약점 몇 개가 남아있는데(주로 Server Actions/이미지 최적화/엣지 캐시 관련 DoS·SSRF), 전부 이 앱이 안 쓰는 기능이거나 breaking change(next 16, googleapis 175)가 필요해서 v1에서는 보류했다. 나중에 `npm audit fix --force` 검토.
