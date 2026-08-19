-- 같은 날짜 안에서 할일 순서를 사용자가 직접 정할 수 있도록.
-- NULL = 아직 순서를 정한 적 없음(항상 정렬 맨 뒤로 감, 즉 시간 없는 항목 중 생성순으로 취급).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS order_index INTEGER;
