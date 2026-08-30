-- BGI-38: setup_new_user / create_user_profile 에 소유권 가드 추가
--
-- 두 함수 모두 SECURITY DEFINER(RLS 우회)이고 대상 uuid 를 인자로 받는데 소유권 검사가
-- 없었다. BGI-37 ④(20260830000004)로 anon 실행 권한은 회수됐지만 authenticated 내부자
-- 경로가 남아 있었다:
--   - setup_new_user: INSERT ... ON CONFLICT (id) DO UPDATE SET email, full_name 이라
--     로그인한 사용자가 남의 uuid 를 넘기면 그 사람의 프로필 이메일/이름을 덮어쓴다(실질 위험).
--   - create_user_profile: 자체는 조기반환(IF EXISTS RETURN TRUE) + DO NOTHING 이라
--     덮어쓰기가 없으나, 내부에서 setup_new_user 를 PERFORM 한다. 일관성을 위해 동일 가드.
--
-- 가드: auth.uid() IS NULL(비로그인) 또는 대상이 본인이 아니면 차단.
--   비교는 IS DISTINCT FROM 을 쓴다('!=' 는 한쪽이 NULL 이면 결과가 NULL → fail-open).
--
-- 앱은 항상 세션 본인 id 로만 호출한다(profileService.ensureProfile → createDefaultLedger/
-- ensureProfile, user id = 세션 사용자). 따라서 정상 흐름에 영향이 없다.
-- create_user_profile → setup_new_user 체인: SECURITY DEFINER 는 DB 롤만 owner 로 바꾸고
-- auth.uid()(request.jwt.claims)는 원 호출자를 유지하므로, 본인 호출이면 내부 호출도 통과한다.
--
-- 주의: create_user_profile 의 EXCEPTION WHEN OTHERS THEN RETURN FALSE 가 가드의 RAISE 를
-- 삼켜, 공격자는 예외 대신 FALSE 를 받는다. 쓰기 자체는 가드 앞에서 차단되므로 보안상 충분하다
-- (핸들러는 건드리지 않는다). setup_new_user 는 핸들러가 없어 RAISE 가 그대로 전달된다.
--
-- setup_new_user 에 빠져 있던 SET search_path = public 도 함께 보강한다(DEFINER 하드닝).
-- 본문은 현재 운영본 그대로, 인자명만 함수별로 정확히 유지한다.
-- CREATE OR REPLACE 는 기존 GRANT(authenticated/service_role)를 보존한다.

-- ============================================================================
-- setup_new_user — 실질 위험(프로필 덮어쓰기). 소유권 가드 + search_path 보강.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.setup_new_user(
  user_uuid uuid,
  user_email text,
  user_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_ledger_id uuid;
BEGIN
  -- 소유권 검사: 본인 계정만 설정할 수 있다.
  IF auth.uid() IS NULL OR user_uuid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '본인 계정만 설정할 수 있습니다.';
  END IF;

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

-- ============================================================================
-- create_user_profile — 일관성 가드. 조기반환/DO NOTHING 으로 자체 덮어쓰기는 없다.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text DEFAULT NULL::text,
  p_avatar_url text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- 소유권 검사: 본인 계정만 설정할 수 있다.
  -- (아래 EXCEPTION WHEN OTHERS 핸들러가 이 RAISE 를 FALSE 로 바꾸지만, 쓰기는 여기서 차단된다.)
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '본인 계정만 설정할 수 있습니다.';
  END IF;

  -- 이미 존재하는지 확인
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN TRUE; -- 이미 존재하면 성공으로 처리
  END IF;

  -- 프로필 생성
  INSERT INTO profiles (
    id,
    email,
    full_name,
    avatar_url,
    currency,
    timezone
  )
  VALUES (
    p_user_id,
    p_email,
    COALESCE(p_full_name, split_part(p_email, '@', 1)),
    p_avatar_url,
    'KRW',
    'Asia/Seoul'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 기본 가계부 생성
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'setup_new_user'
  ) THEN
    PERFORM setup_new_user(
      p_user_id,
      p_email,
      COALESCE(p_full_name, split_part(p_email, '@', 1))
    );
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', p_user_id, SQLERRM;
    RETURN FALSE;
END;
$function$;
