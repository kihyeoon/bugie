-- BGI-37 정리 ③: setup_new_user 보안 속성 드리프트 정합화 (invoker → DEFINER)
--
-- setup_new_user 는 20250729000002 에서 invoker 로 정의됐으나, 프로덕션에서는 DEFINER 로
-- 손수 바뀌어 있었다. 이 함수는 가입 시 첫 가계부를 부트스트랩한다(profiles/ledgers/
-- ledger_members INSERT + activate_default_categories). 신규 유저는 아직 멤버십이 없어
-- invoker(RLS 적용)로는 ledger_members INSERT 등이 막힐 수 있다 → DEFINER 가 올바른 정의다.
-- 마이그레이션(invoker)이 틀렸고 프로덕션(DEFINER)이 맞으므로, 프로덕션 본문 기준으로 재정의해
-- 로컬/프로덕션을 DEFINER 로 재수렴시킨다. 지금 fresh 배포가 나면 invoker 버전이 가입을
-- 깨뜨릴 수 있어, 이 정합화 자체가 회귀 예방이다.
--
-- 소유권 가드(auth.uid() = user_uuid)는 이 마이그레이션에 넣지 않는다 → BGI-38 에서 별도 처리.
-- 여기서는 순수하게 보안 속성(invoker→DEFINER)만 프로덕션에 맞춘다. 본문은 현재 운영본 그대로.
--
-- CREATE OR REPLACE 는 기존 GRANT(authenticated/service_role)를 보존한다.

CREATE OR REPLACE FUNCTION public.setup_new_user(
  user_uuid uuid,
  user_email text,
  user_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  new_ledger_id uuid;
BEGIN
  -- 프로필 생성 (시스템 권한 필요)
  INSERT INTO profiles (id, email, full_name)
  VALUES (user_uuid, user_email, user_name)
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    full_name = excluded.full_name;

  -- 기본 원장 생성
  INSERT INTO ledgers (name, description, created_by)
  VALUES (user_name || '의 가계부', '개인 가계부입니다.', user_uuid)
  RETURNING id INTO new_ledger_id;

  -- 원장 소유자로 추가
  INSERT INTO ledger_members (ledger_id, user_id, role)
  VALUES (new_ledger_id, user_uuid, 'owner');

  -- 기본 카테고리 활성화
  PERFORM activate_default_categories(new_ledger_id);

  RETURN new_ledger_id;
END;
$function$;
