-- BGI-45: 거래 검색. 제목·메모 부분 일치(대소문자 무시). 정렬·개수 제한은 호출하는 쪽이 붙인다.
-- ilike 대신 strpos를 쓴다. 와일드카드가 없어 사용자 입력(% _ * 등)을 이스케이프할 필요가 없다.
-- 설계: docs/features/search/design.md
-- ⚠ 반환형이 active_transactions 뷰에 묶여 있다. 뷰를 다시 만드는 마이그레이션은 설계 §8의 순서를 따른다.
--   (CASCADE로 지우면 이 함수가 조용히 사라지고, 새 뷰엔 authenticated SELECT도 없다.)
-- ⚠ 본문을 BEGIN ATOMIC으로 바꾸지 말 것. select *가 만들 때 고정돼 뷰에 컬럼을 더하면 반환형과 어긋난다.

create function public.search_transactions(
  p_ledger_id uuid,
  p_keyword text
)
returns setof public.active_transactions
language sql
stable
set search_path = public
as $$
  select *
  from public.active_transactions t
  where t.ledger_id = p_ledger_id
    -- 빈 검색어는 strpos가 1을 돌려 전부 걸린다. 클라이언트도 막지만 여기서 한 번 더 막는다.
    and btrim(p_keyword) <> ''
    and (
      strpos(lower(t.title), lower(p_keyword)) > 0
      or strpos(lower(coalesce(t.description, '')), lower(p_keyword)) > 0
    );
$$;

-- 함수 EXECUTE는 기본으로 PUBLIC·anon에 열리므로 둘 다 회수한다.
revoke execute on function public.search_transactions(uuid, text) from anon, public;
grant execute on function public.search_transactions(uuid, text) to authenticated, service_role;

comment on function public.search_transactions(uuid, text) is
  '가계부 거래 검색(제목·메모 부분 일치, 대소문자 무시). active_transactions 뷰를 읽는다. RLS 적용(SECURITY INVOKER) — DEFINER로 바꾸지 말 것.';

notify pgrst, 'reload schema';
