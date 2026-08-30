-- BGI-37 정리 ③: rls_auto_enable 이벤트 트리거를 마이그레이션에 편입 (드리프트 해소)
--
-- rls_auto_enable() + 이벤트 트리거 ensure_rls 는 프로덕션 대시보드에서만 만들어져
-- 마이그레이션 이력에 없었다. 새 public 테이블 생성 시 RLS 를 자동으로 켜주는 안전장치라
-- 유익하다(향후 RLS 누락 사고 예방). 이력에 편입해 로컬/프로덕션을 정합화한다.
--
-- 함수 CREATE OR REPLACE 는 어디서나 가능하다(superuser 불필요).
-- 이벤트 트리거 생성은 superuser 권한이 필요할 수 있어, '없을 때만 생성 + 권한 없으면 건너뜀'
-- 으로 감싼다. 현재 프로덕션엔 ensure_rls 가 이미 있어 이 블록은 skip 된다(권한 불필요).
-- 로컬(및 fresh 환경)에선 새로 생성돼 프로덕션과 같은 안전장치를 갖춘다.

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL
       AND cmd.schema_name IN ('public')
       AND cmd.schema_name NOT IN ('pg_catalog','information_schema')
       AND cmd.schema_name NOT LIKE 'pg_toast%'
       AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    ELSE
      RAISE LOG 'rls_auto_enable: skip % (system schema or not enforced: %)', cmd.object_identity, cmd.schema_name;
    END IF;
  END LOOP;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    BEGIN
      CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
        WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
        EXECUTE FUNCTION public.rls_auto_enable();
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'ensure_rls 생성 권한 없음 — 건너뜀 (프로덕션엔 이미 존재)';
    END;
  END IF;
END $$;
