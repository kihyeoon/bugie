-- paid_by 컬럼 추가: "누가 실제로 돈을 썼는지" 구분
-- 기존 created_by(입력자)와 paid_by(실제 지출자)를 분리

-- 1. paid_by 컬럼 추가 (nullable, 기존 데이터 영향 없음)
ALTER TABLE transactions
  ADD COLUMN paid_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. active_transactions 뷰 재생성 (paid_by_name LEFT JOIN 추가)
DROP VIEW IF EXISTS active_transactions CASCADE;

CREATE VIEW active_transactions AS
SELECT
  t.*,
  cd.name AS category_name,
  cd.color AS category_color,
  cd.icon AS category_icon,
  cd.source_type AS category_source,
  l.name AS ledger_name,
  p.full_name AS created_by_name,
  p2.full_name AS paid_by_name
FROM transactions t
JOIN category_details cd ON t.category_id = cd.id
JOIN ledgers l ON t.ledger_id = l.id
LEFT JOIN profiles p ON t.created_by = p.id
LEFT JOIN profiles p2 ON t.paid_by = p2.id
WHERE t.deleted_at IS NULL
  AND l.deleted_at IS NULL;

COMMENT ON VIEW active_transactions IS '활성 거래 목록 (탈퇴한 사용자 거래 포함, 지출자 정보 포함)';
COMMENT ON COLUMN active_transactions.paid_by_name IS '실제 지출자 이름 (NULL이면 작성자와 동일)';
