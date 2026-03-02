-- 카테고리 이름 중복 제약 조건 개선
-- 이슈: 삭제된 카테고리의 이름을 재사용할 수 없는 문제 해결
-- 해결: 활성 카테고리(deleted_at IS NULL)만 이름 중복 방지하도록 변경

-- 기존 unique constraint 삭제
ALTER TABLE categories DROP CONSTRAINT IF EXISTS unique_ledger_custom_name;

-- 새로운 partial unique index 생성 (활성 카테고리만 중복 체크)
CREATE UNIQUE INDEX unique_active_ledger_custom_name 
ON categories(ledger_id, name, type) 
WHERE deleted_at IS NULL;

-- 코멘트 추가
COMMENT ON INDEX unique_active_ledger_custom_name IS 
'활성 카테고리(삭제되지 않은)에 대해서만 이름 중복을 방지합니다. 삭제된 카테고리 이름은 재사용 가능합니다.';