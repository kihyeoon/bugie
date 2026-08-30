-- BGI-37 ④ restore_deleted_account 본문에 소유권 검사 추가
--
-- 이 함수는 SECURITY DEFINER 라 RLS 를 우회하고, '누구를 복구할지'를 target_user_id 인자로
-- 받는다. 본문에 호출자 == 대상 검사가 없어, 로그인한 사용자가 남의 uuid 를 넘기면
-- 남의 '탈퇴 취소'가 가능했다(= 삭제 요청 무력화). ③(20260830000004)로 anon 은 이미 막혔지만
-- authenticated 내부자 경로가 남아 있어 본문에서 소유권을 확인한다.
--
-- 앱은 항상 본인 id 로만 호출한다(profileService.ensureProfile → restoreDeletedAccount(userId),
-- userId = 세션 사용자). 따라서 target_user_id = auth.uid() 가드는 정상 흐름에 영향이 없다.
--
-- 본문은 현재 프로덕션 정의를 기준으로 소유권 가드만 얹고, DEFINER 함수에 빠져 있던
-- SET search_path = public 을 함께 채운다(하드닝).

CREATE OR REPLACE FUNCTION public.restore_deleted_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_deleted_at TIMESTAMP;
  v_days_since_deletion INTEGER;
BEGIN
  -- 소유권 검사: 본인 계정만 복구할 수 있다.
  -- auth.uid() IS NULL(비로그인) 또는 대상이 본인이 아니면 차단.
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '본인 계정만 복구할 수 있습니다.';
  END IF;

  -- 프로필의 삭제 상태 확인
  SELECT deleted_at INTO v_deleted_at
  FROM profiles
  WHERE id = target_user_id;

  -- 계정이 삭제되지 않았거나 존재하지 않는 경우
  IF v_deleted_at IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Account is not deleted or does not exist'
    );
  END IF;

  -- 삭제 후 경과 일수 계산
  v_days_since_deletion := EXTRACT(DAY FROM NOW() - v_deleted_at)::INTEGER;

  -- 유예 기간(30일) 초과 확인
  IF v_days_since_deletion > 30 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Recovery period expired',
      'days_since_deletion', v_days_since_deletion
    );
  END IF;

  -- 계정 복구 처리
  UPDATE profiles
  SET
    deleted_at = NULL,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- 복구 성공 결과 반환
  RETURN json_build_object(
    'success', true,
    'message', 'Account successfully restored',
    'days_since_deletion', v_days_since_deletion
  );
END;
$function$;
