-- 할일에 설정한 시각('HH:MM')을 그대로 보관 -- 구글 캘린더 등록 성공 여부와 무관하게
-- 화면에 "몇 시에 뭐가 있는지" 표시하기 위함.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time TEXT;
