-- BGI-37 정리 ②: 미사용 notes 테이블 제거
--
-- notes 는 Supabase Quickstart 예제의 잔재다. 어느 마이그레이션에서도 만든 적이 없고
-- (프로덕션 대시보드에만 존재), 앱/코어 어디서도 참조하지 않으며 0행이다.
-- 열람 정책이 USING (true) 라 인증만 하면 아무나 읽고, INSERT 도 authenticated 면 통과해
-- 저위험이지만 무의미한 남용 벡터로 남아 있었다. 들어오는 FK 참조가 없어 안전하게 제거한다.
--
-- 프로덕션에만 있으므로 IF EXISTS 로 감싼다(로컬 db reset 안전).

DROP TABLE IF EXISTS public.notes;
