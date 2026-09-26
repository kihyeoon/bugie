-- BGI-52: 새 버전 안내 — 플랫폼별 권장/최소 지원 버전. null이면 해당 안내를 하지 않는다.
-- 값은 운영자가 직접 바꾸는 운영 데이터다. 사용법과 주의점: docs/guide/app-version-policy.md

create table public.app_versions (
  platform text primary key,
  recommended_version text
    check (recommended_version ~ '^\d+\.\d+\.\d+$'),
  recommended_message text,
  min_supported_version text
    check (min_supported_version ~ '^\d+\.\d+\.\d+$')
);

comment on table public.app_versions is
  '플랫폼별 앱 버전 정책(BGI-52). 값은 운영자가 직접 수정한다. null이면 해당 안내 안 함.';

-- 1) Data API GRANT
-- anon 예외: 강제 업데이트는 로그인 전(로그인 화면, 딥링크 콜드 스타트)에도 확인해야 한다.
-- 버전 번호와 안내 문구뿐이라 공개돼도 무해하다. 쓰기는 클라이언트 롤에 주지 않는다.
grant select on public.app_versions to anon, authenticated;
grant select, insert, update, delete on public.app_versions to service_role;

-- 2) RLS
alter table public.app_versions enable row level security;

-- 3) 정책: 누구나 읽기만
create policy "app_versions_select_policy" on public.app_versions
  for select to anon, authenticated
  using (true);

-- 초기 행: 안내도 차단도 하지 않는 상태로 시작한다
insert into public.app_versions (platform) values ('ios');
