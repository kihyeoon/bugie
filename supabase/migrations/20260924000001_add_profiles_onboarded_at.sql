-- BGI-40: 가입 시 닉네임 설정 단계
--
-- 앱은 "닉네임을 정했는가"를 이름 유무(!full_name)로 판정해 왔다. 그런데 애플 가입자는 이름이 이메일 앞부분
-- (Private Relay라 vtnh59jpv9 같은 무작위 문자열)으로 채워져 판정을 통과하고, 닉네임 화면을 보지 못했다.
-- 이름의 모양으로 추측하지 않고 사용자가 직접 정했다는 사실을 기록한다.
--
-- onboarded_at: 닉네임 화면에서 저장한 시각. null이면 앱이 닉네임 화면을 보여준다.
--
-- 기존 테이블에 컬럼만 추가하므로 GRANT/RLS는 그대로다(테이블 단위 GRANT가 새 컬럼을 포함하고,
-- profiles_own_all 정책이 본인 행 수정만 허용한다). default 없는 nullable 컬럼이라 잠금이 짧다.

alter table public.profiles add column onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  '닉네임 설정 완료 시각. null이면 앱이 가입 닉네임 화면을 보여준다(BGI-40).';

-- 기존 사용자 백필: 이름이 이메일 앞부분이 아니면 이미 이름을 정한 것으로 본다.
-- 앞부분 이름(create_user_profile의 COALESCE 폴백)인 사용자만 null로 남아 다음 실행 때 닉네임 화면을 한 번 본다.
-- 2026-09-24 프로덕션 기준 40명 중 27명 완료, 13명 null.
update public.profiles
set onboarded_at = coalesce(created_at, now())
where full_name is not null
  and full_name <> split_part(email, '@', 1);
