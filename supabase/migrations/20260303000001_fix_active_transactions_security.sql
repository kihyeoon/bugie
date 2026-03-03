-- 모든 public 뷰를 SECURITY INVOKER로 전환
-- SECURITY DEFINER(기본값)가 RLS를 우회하는 문제 수정

ALTER VIEW category_details SET (security_invoker = on);
ALTER VIEW active_transactions SET (security_invoker = on);
ALTER VIEW budget_vs_actual SET (security_invoker = on);
ALTER VIEW ledger_monthly_summary SET (security_invoker = on);
