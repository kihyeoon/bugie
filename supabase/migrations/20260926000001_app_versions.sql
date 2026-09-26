-- BGI-52: 새 버전 안내 — 플랫폼별 권장/최소 지원 버전
--
-- 앱이 켜질 때(그리고 포그라운드로 돌아올 때) 이 행을 읽어
--   · 현재 버전 < min_supported_version  → 앱 사용을 막고 업데이트로 보낸다(강제)
--   · 현재 버전 < recommended_version    → 업데이트를 권하는 Alert를 한 번 띄운다(권장)
-- 값이 null이면 해당 안내를 하지 않는다. 기본은 전부 null(아무것도 안 함).
--
-- 값은 운영자가 Studio나 SQL로 직접 바꾼다(운영 데이터). 스키마만 마이그레이션으로 관리한다.
--   · recommended_version은 App Store에 실제 게시된 뒤에만 넣는다(심사 중이면 스토어에 새 버전이 없다)
--   · min_supported_version은 심사 중인 버전보다 높게 두지 않는다(심사관 앱이 막히면 리젝)

create table public.app_versions (
  platform text primary key,
  recommended_version text
    check (recommended_version ~ '^\d+\.\d+\.\d+$'),
  recommended_message text,
  min_supported_version text
    check (min_supported_version ~ '^\d+\.\d+\.\d+$'),
  updated_at timestamptz not null default now()
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

-- 값을 고칠 때 updated_at을 자동 갱신한다(운영자가 언제 바꿨는지 추적)
create function public.touch_app_versions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger app_versions_touch_updated_at
  before update on public.app_versions
  for each row execute function public.touch_app_versions_updated_at();

-- 초기 행: 안내도 차단도 하지 않는 상태로 시작한다
insert into public.app_versions (platform) values ('ios');
