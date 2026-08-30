-- BGI-37 ③ 심층 방어: SECURITY DEFINER 함수의 anon/PUBLIC 실행 권한 회수
--
-- DEFINER 함수는 RLS 를 우회하므로, anon(=앱 번들에 실린 공개 키)에게 EXECUTE 가 열려 있으면
-- 로그인 없이 호출된다. ①②로 실제 데이터 경로는 막았지만, 함수 자체를 못 부르게 막는 것이
-- 근본 방어다. Postgres 는 함수 생성 시 PUBLIC 에, Supabase 는 anon 에 EXECUTE 를 자동 부여하므로
-- 둘 다 회수해야 한다(한쪽만 하면 무효 — BGI-37 교훈).
--
-- 원칙: 회수 후 '실제로 부르는 롤'에만 다시 부여한다.
--   - 배치/수동 함수      → service_role 만 (scripts/process-deletions.js 는 service_role 키)
--   - 앱이 로그인 후 호출  → authenticated (+ service_role)
--   - 미사용/내부 전용     → 모든 클라이언트 롤 회수
--
-- is_ledger_member 는 건드리지 않는다. RLS 정책이 호출하는 null-safe 헬퍼라 anon 이 필요하다
-- (20260830000002 참조). rls_auto_enable 은 이벤트 트리거라 API 로 호출 불가지만 정리 차원에서 회수.
--
-- 로컬에 없고 프로덕션에만 있는 함수(force_delete_auth_user_with_constraints,
-- process_account_deletions_v2, rls_auto_enable)가 있어, 존재할 때만 실행하도록 가드한다.

DO $$
DECLARE
  sig text;

  -- 배치/수동 전용: service_role 만
  svc_only text[] := ARRAY[
    'force_clean_user(uuid)',
    'force_delete_auth_user_with_constraints(uuid)',
    'process_account_deletions()',
    'process_account_deletions_clean()',
    'process_account_deletions_v2()'
  ];

  -- 앱이 로그인(authenticated) 상태에서 호출. AuthContext 는 세션 확립 후에만 호출한다.
  auth_roles text[] := ARRAY[
    'create_user_profile(uuid,text,text,text)',
    'setup_new_user(uuid,text,text)',
    'restore_deleted_account(uuid)',
    'get_user_ledgers()',
    'invite_member_to_ledger(uuid,text,member_role)',
    'transfer_ledger_ownership(uuid,uuid)',
    'soft_delete_category(uuid)',
    'soft_delete_ledger(uuid)',
    'soft_delete_payment_method(uuid)',
    'soft_delete_profile()',
    'soft_delete_transaction(uuid)'
  ];

  -- 앱/배치 어디서도 .rpc() 호출 없음. 내부(DEFINER 간 호출)나 이벤트 트리거로만 쓰이므로
  -- 모든 클라이언트 롤에서 회수한다. DEFINER 가 내부에서 부를 땐 소유자 권한이라 영향 없다.
  locked text[] := ARRAY[
    'add_custom_category(uuid,text,category_type,text,text,integer)',
    'initialize_category_templates()',
    'rls_auto_enable()'
  ];
BEGIN
  FOREACH sig IN ARRAY svc_only LOOP
    IF to_regprocedure('public.' || sig) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', sig);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%s TO service_role', sig);
    END IF;
  END LOOP;

  FOREACH sig IN ARRAY auth_roles LOOP
    IF to_regprocedure('public.' || sig) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, PUBLIC', sig);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%s TO authenticated', sig);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%s TO service_role', sig);
    END IF;
  END LOOP;

  FOREACH sig IN ARRAY locked LOOP
    IF to_regprocedure('public.' || sig) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', sig);
    END IF;
  END LOOP;
END $$;
