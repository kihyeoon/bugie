-- 탈퇴 후 30일 이내 계정 자동 복구를 위한 RPC 함수
CREATE OR REPLACE FUNCTION restore_deleted_account(target_user_id UUID)
RETURNS json AS $$
DECLARE
  v_deleted_at TIMESTAMP;
  v_days_since_deletion INTEGER;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 인증된 사용자에게 실행 권한 부여
GRANT EXECUTE ON FUNCTION restore_deleted_account(UUID) TO authenticated;

-- 함수 설명 추가
COMMENT ON FUNCTION restore_deleted_account(UUID) IS 
'탈퇴 후 30일 이내에 호출하면 계정을 자동으로 복구합니다. 
복구 성공 여부와 세부 정보를 JSON으로 반환합니다.';