-- 캘린더용 일별 합계 RPC
--
-- 기존 getMonthlySummary는 한 달 행을 select('*')로 전부 받아 클라이언트에서 합산했다.
-- 거래가 쌓일수록 홈 진입이 무거워지므로 집계를 DB로 내린다 (BGI-36).
--
-- SECURITY DEFINER를 쓰지 않는다. 이 저장소의 다른 RPC(soft_delete_*)는 RLS를 우회해야 해서
-- DEFINER지만, 이건 읽기 집계라 RLS가 적용돼야 한다. DEFINER로 만들면 남의 가계부 합계가 샌다.
-- 기본값 SECURITY INVOKER면 transactions_policy(멤버십 + deleted_at IS NULL)가 그대로 걸린다.
--
-- 그래도 deleted_at은 본문에서 한 번 더 거른다. RLS에만 맡기면 RLS를 우회하는 호출자
-- (service_role, superuser)가 삭제된 거래까지 합산해 조용히 틀린 숫자를 받는다.
-- 교체 이전 구현도 .is('deleted_at', null)을 명시적으로 걸고 있었다.

CREATE OR REPLACE FUNCTION get_daily_summary(
  p_ledger_id uuid,
  p_year int,
  p_month int
)
RETURNS TABLE (
  summary_date date,
  income numeric,
  expense numeric,
  transaction_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.transaction_date,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0),
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0),
    COUNT(*)
  FROM transactions t
  WHERE t.ledger_id = p_ledger_id
    AND t.deleted_at IS NULL
    -- 반열린 구간 [1일, 다음 달 1일). 월말 일수를 손으로 계산하지 않는다.
    AND t.transaction_date >= make_date(p_year, p_month, 1)
    AND t.transaction_date < (make_date(p_year, p_month, 1) + interval '1 month')
  GROUP BY t.transaction_date
  ORDER BY t.transaction_date;
$$;

-- Data API GRANT (2026-10-30 이후 자동 부여 종료)
GRANT EXECUTE ON FUNCTION get_daily_summary(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_summary(uuid, int, int) TO service_role;

COMMENT ON FUNCTION get_daily_summary(uuid, int, int) IS
  '가계부의 월별 일간 수입/지출/건수 집계. RLS 적용(SECURITY INVOKER) — DEFINER로 바꾸지 말 것.';
