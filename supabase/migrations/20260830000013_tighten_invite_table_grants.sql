-- BGI-22 보강: 초대 테이블의 자동 부여 GRANT 회수 (최소 권한)
--
-- 20260830000012 에서 authenticated 에 select 만 명시했는데, 프로덕션 실측 결과 세 테이블 모두
-- anon/authenticated 에 ALL(INSERT/UPDATE/DELETE/TRUNCATE 포함)이 붙어 있었다.
-- 원인은 Supabase 의 기본 권한(default privileges)이 public 스키마 신규 테이블에 자동으로
-- 권한을 부여하기 때문이다(2026-10-30 이전 정책). 명시적 GRANT 는 그 위에 얹힌 것뿐이라
-- 자동 부여분이 남는다.
--
-- 실질 침해는 RLS 가 막고 있었다(세 테이블 모두 INSERT/UPDATE/DELETE 정책이 없어 해당 동작 차단,
-- TRUNCATE 는 소유자 전용). 그래도 "GRANT = 테이블 접근, RLS = 행 필터"라는 두 관문 중
-- 하나가 열려 있는 상태이므로, 심층 방어와 CLAUDE.md 규약(명시적 최소 GRANT)에 맞춰 회수한다.
--
-- 쓰기는 전부 SECURITY DEFINER RPC(create/accept/revoke_ledger_invite)가 전담하므로
-- 클라이언트 롤에 쓰기 권한이 필요 없다. 조회만 RLS 와 함께 authenticated 에 남긴다.

-- ============================================================================
-- 1) 전면 회수 후 필요한 것만 재부여
-- ============================================================================
revoke all on public.ledger_invites            from anon, authenticated;
revoke all on public.ledger_invite_acceptances from anon, authenticated;
revoke all on public.invite_accept_attempts    from anon, authenticated;

-- 조회만 허용 (행 단위 필터는 RLS select 정책이 담당: owner/admin 의 가계부만)
grant select on public.ledger_invites            to authenticated;
grant select on public.ledger_invite_acceptances to authenticated;

-- invite_accept_attempts: rate limit 내부 데이터. 클라이언트 접근 불필요(RPC/배치 전용).
-- authenticated/anon 에 아무 권한도 주지 않는다.

-- service_role 은 배치/운영용으로 유지 (20260830000012 에서 부여됨)

-- ============================================================================
-- 2) 앞으로 만들 테이블에도 자동 부여가 붙지 않도록 기본 권한 정리
-- ============================================================================
-- postgres 가 public 스키마에 만드는 테이블에 대해 anon/authenticated 자동 부여를 끈다.
-- 기존 테이블에는 영향이 없고(위에서 개별 회수), 이후 신규 테이블은 마이그레이션에 명시한
-- GRANT 만 갖게 된다 — CLAUDE.md 표준 템플릿과 동일한 상태.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 참고(실측): pg_default_acl 에는 postgres 소유 행 외에 supabase_admin 소유 행도 있다.
-- 위 문장은 마이그레이션 실행 롤(postgres)의 기본 권한만 지운다. 즉 대시보드 등 supabase_admin
-- 경로로 만든 테이블에는 여전히 자동 부여가 붙는다. "DB는 대시보드로 고치지 않는다"(CLAUDE.md)
-- 규약을 지키는 한 마이그레이션 경로만 쓰이므로 문제되지 않는다.
--
-- 또한 이번 실측에서 기존 테이블들에도 같은 자동 ALL GRANT 가 남아 있음이 드러났다(RLS 가
-- 막고 있어 실질 위험은 아님). 전수 정리는 별도 감사가 필요하므로 이 마이그레이션 범위에
-- 넣지 않고 Linear 백로그로 분리한다.
