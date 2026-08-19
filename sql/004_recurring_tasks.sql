-- 매일 반복되는 할일들을 하나의 시리즈로 묶기 위한 컬럼.
-- 시리즈의 첫 항목도 자기 id를 recurrence_id로 갖는다(자기참조) -- 그래야
-- "WHERE recurrence_id = X" 한 줄로 시리즈 전체(첫 항목 포함)를 찾을 수 있다.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(recurrence_id);
