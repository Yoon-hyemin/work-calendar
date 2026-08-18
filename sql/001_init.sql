-- 팀원. 관리자가 초대하거나(row를 미리 만들어둠) 지정 관리자 이메일이 최초 로그인할 때 생성된다.
-- status='removed'는 물리적으로 지우지 않고 접근만 회수한 상태 -- tasks/shares 이력을 보존하기 위함.
CREATE TABLE IF NOT EXISTS members (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 하루치 할일 한 건.
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL REFERENCES members(email),
  date DATE NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  calendar_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_email_date ON tasks(email, date);

-- 캘린더 공유 관계: viewer_email이 target_email의 캘린더를 볼 수 있는지.
-- pending = 요청됨(관리자 승인 대기), approved = 승인되어 실제로 보임.
CREATE TABLE IF NOT EXISTS shares (
  id SERIAL PRIMARY KEY,
  viewer_email TEXT NOT NULL REFERENCES members(email),
  target_email TEXT NOT NULL REFERENCES members(email),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(viewer_email, target_email)
);
