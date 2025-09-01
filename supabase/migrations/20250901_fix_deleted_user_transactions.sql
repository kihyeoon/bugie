-- Fix: 탈퇴한 사용자의 거래가 상세 화면에서 보이지 않는 문제 수정
-- 
-- 문제: active_transactions 뷰가 profiles와 INNER JOIN을 사용하여
--      탈퇴한 사용자(soft delete)의 거래가 조회되지 않음
-- 해결: LEFT JOIN으로 변경하여 profile이 없어도 거래 데이터는 표시되도록 수정
--
-- Generated: 2025-09-01

-- 기존 뷰 삭제
DROP VIEW IF EXISTS active_transactions CASCADE;

-- 뷰 재생성 (LEFT JOIN 사용)
CREATE VIEW active_transactions AS
SELECT
  t.*,
  cd.name AS category_name,
  cd.color AS category_color,
  cd.icon AS category_icon,
  cd.source_type AS category_source,
  l.name AS ledger_name,
  p.full_name AS created_by_name  -- 탈퇴한 사용자는 NULL이 됨
FROM transactions t
JOIN category_details cd ON t.category_id = cd.id
JOIN ledgers l ON t.ledger_id = l.id
LEFT JOIN profiles p ON t.created_by = p.id  -- LEFT JOIN으로 변경
WHERE t.deleted_at IS NULL
  AND l.deleted_at IS NULL;

-- 뷰에 대한 설명 추가
COMMENT ON VIEW active_transactions IS '활성 거래 목록 (탈퇴한 사용자 거래 포함)';
COMMENT ON COLUMN active_transactions.created_by_name IS '작성자 이름 (탈퇴한 사용자는 NULL)';