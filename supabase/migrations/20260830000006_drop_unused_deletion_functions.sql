-- BGI-37 정리 ①: 미사용 계정삭제 함수 제거
--
-- force_delete_auth_user_with_constraints(uuid), process_account_deletions_v2() 는
-- 마이그레이션에 없이 프로덕션 대시보드에서 수동 생성됐던 사장 함수다.
-- 참조 전수 확인 결과 앱/코어/트리거/다른 함수/배치 스크립트/CI 어디서도 호출하지 않는다.
-- SECURITY DEFINER + 내부 인증검사 없음이라, ③에서 권한은 회수했지만 사장 함수는 남겨두기보다
-- 제거하는 편이 공격 표면을 확실히 줄인다(안 쓰는 문은 잠그는 것보다 없애는 게 낫다).
--
-- 로컬엔 없고 프로덕션에만 있으므로 IF EXISTS 로 감싼다(로컬 db reset 안전).

DROP FUNCTION IF EXISTS public.force_delete_auth_user_with_constraints(uuid);
DROP FUNCTION IF EXISTS public.process_account_deletions_v2();
