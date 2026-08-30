-- BGI-37 정리 ③: 미사용 예산/집계/템플릿 함수 제거 + 드리프트 해소
--
-- 아래 세 함수는 20250729000002 에서 정의된 뒤 프로덕션 대시보드에서 보안 속성이 손으로 바뀌어
-- (get_ledger_monthly_stats·set_budget: DEFINER→invoker, initialize_category_templates: invoker→DEFINER)
-- 마이그레이션과 어긋나 있었다. 전수 조사 결과 셋 다 죽은 함수다:
--   - 앱/코어/다른 함수/트리거/뷰/배치 어디서도 호출하지 않는다.
--   - 앱에 예산(budget) 기능 자체가 없어 set_budget·get_ledger_monthly_stats 는 무의미하다.
--   - get_ledger_monthly_stats 는 본문 FULL OUTER JOIN 조건 때문에 실행 자체가 실패한다.
--   - initialize_category_templates 는 seed 마이그레이션(20250729000004)과 중복이다.
-- 재정의로 드리프트만 맞추기보다, 사용처 없는 함수를 제거해 드리프트와 표면을 함께 없앤다.

DROP FUNCTION IF EXISTS public.get_ledger_monthly_stats(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.set_budget(uuid, uuid, numeric, integer, integer);
DROP FUNCTION IF EXISTS public.initialize_category_templates();
