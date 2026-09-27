-- BGI-43: 거래 목록 멤버 필터. p_member_id가 null이면 기존과 동일(가계부 전체).
-- "누구의 거래" = 지출자, 없으면 작성자. 목록 쿼리(core memberFilter)와 같은 규칙이다.
-- 설계: docs/features/member-filter/design.md

-- 인자를 추가하며 create or replace하면 오버로드가 하나 더 생겨 PostgREST 호출이 모호해진다(PGRST203).
-- 한 파일 = 한 트랜잭션이라 함수가 없는 순간은 없다.
drop function public.get_daily_summary(uuid, int, int);

create function public.get_daily_summary(
  p_ledger_id uuid,
  p_year int,
  p_month int,
  p_member_id uuid default null
)
returns table (
  summary_date date,
  income numeric,
  expense numeric,
  transaction_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    t.transaction_date,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
    count(*)
  from transactions t
  where t.ledger_id = p_ledger_id
    and t.deleted_at is null
    -- 반열린 구간 [1일, 다음 달 1일). 월말 일수를 손으로 계산하지 않는다.
    and t.transaction_date >= make_date(p_year, p_month, 1)
    and t.transaction_date < (make_date(p_year, p_month, 1) + interval '1 month')
    and (p_member_id is null or coalesce(t.paid_by, t.created_by) = p_member_id)
  group by t.transaction_date
  order by t.transaction_date;
$$;

-- drop으로 기존 GRANT도 사라졌다. 함수 EXECUTE는 기본으로 PUBLIC·anon에 열리므로 둘 다 회수한다.
revoke execute on function public.get_daily_summary(uuid, int, int, uuid) from anon, public;
grant execute on function public.get_daily_summary(uuid, int, int, uuid) to authenticated, service_role;

comment on function public.get_daily_summary(uuid, int, int, uuid) is
  '가계부의 월별 일간 수입/지출/건수 집계. p_member_id로 멤버 필터(지출자, 없으면 작성자). RLS 적용(SECURITY INVOKER) — DEFINER로 바꾸지 말 것.';

notify pgrst, 'reload schema';
