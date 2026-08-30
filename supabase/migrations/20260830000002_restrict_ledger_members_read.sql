-- BGI-37 ① 정찰 차단: ledger_members / deletion_job_logs 열람 범위 축소
--
-- 문제: ledger_members_select_policy 가 USING (deleted_at IS NULL) 뿐이라
-- 로그인하지 않은 anon 도 전 사용자의 (ledger_id, user_id) 명단을 통째로 읽을 수 있었다.
-- 프로덕션 실측: anon 으로 47행 / 가계부 40개 / 사용자 36명 노출.
-- 이 명단이 있으면 공격자가 표적 가계부 uuid 를 몰라도 되므로, invite/transfer 의
-- NULL fail-open(별도 마이그레이션에서 수정)과 결합해 비로그인 침투가 성립한다.
--
-- 왜 지금까지 이랬나: 20250803000001 이 올바른(자기가 속한 가계부의 멤버만 보이는)
-- 정책을 만들었으나, 그 EXISTS 가 ledger_members 를 자기 참조해 무한 재귀를 일으켰다.
-- 20250803000002 "최종 해법"은 재귀를 피하려고 정책을 전체 공개로 열어버렸다
-- ("Security is enforced at the ledgers table level" — 직접 조회엔 그 방어가 없다).
--
-- 정석 해법: 멤버십 확인을 SECURITY DEFINER 헬퍼로 분리한다. DEFINER 함수 본문은
-- RLS 를 우회하므로 ledger_members 를 다시 읽어도 정책이 재적용되지 않아 재귀가 끊긴다.

-- ============================================================================
-- 1) 재귀를 끊는 멤버십 헬퍼
-- ============================================================================
-- null-safe: anon(auth.uid() = NULL)이면 EXISTS 가 false → 아무 행도 매칭 안 됨.
CREATE OR REPLACE FUNCTION public.is_ledger_member(p_ledger_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM ledger_members lm
    WHERE lm.ledger_id = p_ledger_id
      AND lm.user_id = auth.uid()
      AND lm.deleted_at IS NULL
  );
$$;

-- anon EXECUTE 를 일부러 남긴다. BGI-37 의 "DEFINER 함수에서 anon 회수" 교훈은
-- '파괴적' 함수 대상이다. 이 함수는 읽기 전용 boolean 이고 anon(auth.uid()=NULL)이면
-- 항상 false 라 유출값이 없다(oracle 아님). 그리고 아래 SELECT 정책이 이 함수를 호출하므로
-- anon EXECUTE 를 회수하면 anon 의 ledger_members 조회가 0행이 아니라 42501 에러가 난다.
-- 유출은 어느 쪽이든 막히지만, 깔끔한 0행 동작을 위해 유지한다. 회수하지 말 것.
REVOKE ALL ON FUNCTION public.is_ledger_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ledger_member(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_ledger_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ledger_member(uuid) TO service_role;

COMMENT ON FUNCTION public.is_ledger_member(uuid) IS
  'ledger_members RLS 재귀 회피용. 호출자가 해당 가계부의 활성 멤버인지 boolean 반환. DEFINER로 RLS 우회.';

-- ============================================================================
-- 2) ledger_members 열람 정책: 본인 행 + 본인이 속한 가계부의 co-member 만
-- ============================================================================
-- 앱은 LedgerRepository 에서 ledgers 에 ledger_members(*, profiles(...)) 를 중첩 조회해
-- 가계부 멤버 명단을 그린다(공유 가계부 기능). 그래서 본인 행만으로 좁히면 화면이 깨진다.
-- co-member 까지 허용하되, 남의 가계부 명단은 막는다.
DROP POLICY IF EXISTS ledger_members_select_policy ON public.ledger_members;
CREATE POLICY ledger_members_select_policy ON public.ledger_members
FOR SELECT USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR public.is_ledger_member(ledger_id)
  )
);

-- ============================================================================
-- 3) deletion_job_logs 열람 정책: 배치(service_role) 외 노출 차단
-- ============================================================================
-- USING (true) 라 anon 에게 탈퇴 처리 로그 187행이 노출돼 있었다.
-- 앱은 이 테이블을 읽지 않는다. 배치(scripts/process-deletions.js)는 service_role 키로
-- 돌고, service_role 은 RLS 를 우회하므로 정책을 닫아도 배치는 정상 동작한다.
DROP POLICY IF EXISTS deletion_job_logs_select ON public.deletion_job_logs;
CREATE POLICY deletion_job_logs_select ON public.deletion_job_logs
FOR SELECT USING (
  (auth.jwt() ->> 'role') = 'service_role'
);
