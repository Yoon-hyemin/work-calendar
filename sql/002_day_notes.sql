-- 날짜별 메모/피드백. 할일과 별개로 하루에 하나만 존재 (email+date가 키).
CREATE TABLE IF NOT EXISTS day_notes (
  email TEXT NOT NULL REFERENCES members(email),
  date DATE NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, date)
);
