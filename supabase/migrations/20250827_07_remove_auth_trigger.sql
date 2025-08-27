-- ================================================================
-- 파일명: 20250827_07_remove_auth_trigger.sql
-- 목적: auth 트리거를 제거하고 애플리케이션 레벨에서 프로필 생성
-- 작성일: 2025-08-27
-- 
-- 변경사항:
-- - on_auth_user_created 트리거 제거
-- - 애플리케이션 레이어에서 프로필 생성하도록 변경
-- - 누락된 프로필 복구
-- ================================================================

BEGIN;

-- ================================================================
-- 1. 트리거 제거 (애플리케이션에서 처리하도록 변경)
-- ================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 트리거 함수는 나중에 필요할 수 있으므로 유지
-- handle_new_user() 함수는 RPC로 호출 가능하도록 유지

-- ================================================================
-- 2. 누락된 프로필 복구
-- ================================================================

DO $$
DECLARE
  user_rec RECORD;
  created_count INTEGER := 0;
BEGIN
  -- auth.users에는 있지만 profiles에는 없는 사용자 찾기
  FOR user_rec IN 
    SELECT 
      au.id,
      au.email,
      au.raw_user_meta_data,
      au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
    ORDER BY au.created_at DESC
  LOOP
    BEGIN
      -- 프로필 생성
      INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        avatar_url,
        currency,
        timezone,
        created_at,
        updated_at
      )
      VALUES (
        user_rec.id,
        user_rec.email,
        COALESCE(
          user_rec.raw_user_meta_data->>'full_name',
          user_rec.raw_user_meta_data->>'name',
          split_part(user_rec.email, '@', 1)
        ),
        user_rec.raw_user_meta_data->>'avatar_url',
        'KRW',
        'Asia/Seoul',
        user_rec.created_at,
        NOW()
      );
      
      created_count := created_count + 1;
      RAISE NOTICE 'Created profile for user: %', user_rec.email;
      
      -- 기본 가계부도 생성 (setup_new_user 함수가 있으면 호출)
      IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'setup_new_user'
      ) THEN
        BEGIN
          PERFORM setup_new_user(
            user_rec.id,
            user_rec.email,
            COALESCE(
              user_rec.raw_user_meta_data->>'full_name',
              user_rec.raw_user_meta_data->>'name',
              split_part(user_rec.email, '@', 1)
            )
          );
          RAISE NOTICE 'Created default ledger for user: %', user_rec.email;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Failed to create default ledger for %: %', 
              user_rec.email, SQLERRM;
        END;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create profile for %: %', 
          user_rec.email, SQLERRM;
    END;
  END LOOP;
  
  IF created_count > 0 THEN
    RAISE NOTICE 'Total profiles created: %', created_count;
  ELSE
    RAISE NOTICE 'No missing profiles found';
  END IF;
END $$;

-- ================================================================
-- 3. RPC 함수 생성 (애플리케이션에서 호출 가능)
-- ================================================================

-- 프로필 생성 RPC 함수
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

-- 함수에 대한 설명 추가
COMMENT ON FUNCTION create_user_profile IS 
'애플리케이션에서 호출하여 사용자 프로필을 생성하는 함수.
트리거 대신 명시적으로 호출하여 사용.';

-- ================================================================
-- 4. 권한 부여
-- ================================================================

-- authenticated 사용자가 자신의 프로필을 생성할 수 있도록 권한 부여
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;

COMMIT;

-- ================================================================
-- 롤백 스크립트 (필요시 사용)
-- ================================================================
/*
BEGIN;

-- 트리거 재생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RPC 함수 제거
DROP FUNCTION IF EXISTS create_user_profile;

COMMIT;
*/