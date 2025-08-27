# 회원 탈퇴 기능 테스트 가이드

## 📋 테스트 준비

### 1. 마이그레이션 실행

Supabase 대시보드에서 다음 순서로 마이그레이션을 실행하세요:

```sql
-- 1. CASCADE 제거 (필수!)
-- 20250827_01_remove_cascade.sql

-- 2. 추적 테이블 생성
-- 20250827_02_create_tracking_tables.sql

-- 3. 완전 삭제 함수 생성 (Phase 2)
-- 20250827_04_improve_deletion_process.sql

-- 4. 불필요한 함수 정리
-- 20250827_05_cleanup_unused_functions.sql

-- 5. ON DELETE SET NULL 최적화 (Phase 3 - 최종)
-- 20250827_06_optimize_with_set_null.sql
```

### 2. GitHub Secrets 설정

Repository Settings > Secrets and variables > Actions에서:

- `SUPABASE_URL`: https://xxxxx.supabase.co
- `SUPABASE_SERVICE_KEY`: service_role key (eyJhbGc...)

⚠️ **주의**: anon key가 아닌 service_role key를 사용해야 합니다!

### 3. 외래키 제약 확인

```sql
-- ON DELETE SET NULL로 변경되었는지 확인
SELECT 
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc 
  ON rc.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('transactions', 'budgets', 'ledgers')
  AND kcu.column_name = 'created_by';
-- 결과: delete_rule이 'SET NULL'이어야 함
```

## 🧪 테스트 시나리오

### 시나리오 0: ON DELETE SET NULL 검증 (최우선)

```sql
-- 외래키가 SET NULL로 변경되었는지 확인
SELECT 
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc 
  ON rc.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('transactions', 'budgets', 'ledgers')
  AND kcu.column_name = 'created_by';

-- 결과: delete_rule이 모두 'SET NULL'이어야 함
```

### 시나리오 1: CASCADE 제거 확인

```sql
-- CASCADE가 제거되었는지 확인
SELECT 
  tc.table_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'profiles'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 결과: delete_rule이 'NO ACTION'이어야 함
```

### 시나리오 2: 테스트 데이터 생성 및 완전 삭제

```sql
-- 1. 31일 전 탈퇴한 테스트 계정 생성
INSERT INTO profiles (id, email, full_name, deleted_at, created_at)
VALUES (
  gen_random_uuid(),
  'test1@example.com',
  'Test User 1',
  NOW() - INTERVAL '31 days',
  NOW() - INTERVAL '60 days'
);

-- 2. 29일 전 탈퇴한 계정 (처리 안 됨)
INSERT INTO profiles (id, email, full_name, deleted_at, created_at)
VALUES (
  gen_random_uuid(),
  'test2@example.com',
  'Test User 2',
  NOW() - INTERVAL '29 days',
  NOW() - INTERVAL '60 days'
);

-- 3. RPC 함수 테스트 실행 (완전 삭제)
SELECT process_account_deletions();

-- 4. 결과 확인
-- test1은 삭제됨, test2는 그대로
SELECT id, email, full_name, deleted_at
FROM profiles 
WHERE email IN ('test1@example.com', 'test2@example.com');

-- 5. deleted_accounts 테이블 확인 (이메일 해시만 저장)
SELECT * FROM deleted_accounts 
ORDER BY created_at DESC;

-- 6. 특정 사용자 강제 삭제 테스트
SELECT force_clean_user('user-uuid-here');
```

### 시나리오 3: GitHub Actions Dry Run

```bash
# 1. GitHub Actions 페이지로 이동
# https://github.com/[owner]/bugie/actions

# 2. "Process Account Deletions" 워크플로우 선택

# 3. "Run workflow" 클릭

# 4. Dry run 체크박스 활성화

# 5. "Run workflow" 실행

# 6. 로그 확인 - "[DRY RUN] Would delete" 메시지 확인
```

### 시나리오 4: 로컬 테스트

```bash
# 1. 환경 변수 설정
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGc..."
export DRY_RUN="true"

# 2. 의존성 설치
npm install @supabase/supabase-js

# 3. 스크립트 실행
node scripts/process-deletions.js

# 4. 로그 확인
cat deletion-report.log
```

### 시나리오 5: 실제 실행 및 모니터링

```sql
-- 1. 처리 대상 확인
SELECT 
  COUNT(*) as pending_count,
  MIN(deleted_at) as oldest_deletion
FROM profiles
WHERE deleted_at IS NOT NULL
  AND deleted_at <= NOW() - INTERVAL '30 days'
  AND email NOT LIKE 'deleted-%';

-- 2. GitHub Actions 실제 실행 (Dry run 체크 해제)

-- 3. 실행 로그 확인
SELECT * FROM deletion_job_logs
ORDER BY executed_at DESC
LIMIT 10;

-- 4. 에러 확인
SELECT 
  executed_at,
  error_count,
  errors
FROM deletion_job_logs
WHERE error_count > 0
ORDER BY executed_at DESC;
```

## 🔍 검증 체크리스트

### 데이터베이스
- [ ] CASCADE가 NO ACTION으로 변경됨
- [ ] deleted_accounts 테이블 생성됨
- [ ] deletion_job_logs 테이블 생성됨
- [ ] process_account_deletions() 함수 생성됨

### GitHub Actions
- [ ] Secrets 설정됨 (SUPABASE_URL, SUPABASE_SERVICE_KEY)
- [ ] Dry run 모드 정상 작동
- [ ] 실패 시 Issue 생성됨

### 완전 삭제 프로세스
- [ ] 30일 경과 계정만 처리됨
- [ ] profiles 테이블에서 완전 삭제됨
- [ ] transactions, budgets, ledgers의 created_by가 NULL로 변경됨
- [ ] deleted_accounts에 이메일 해시만 저장됨 (재가입 체크용)

### 재가입 체크
```typescript
// 재가입 시도 테스트 코드
async function testReregistration(email: string) {
  // SHA256 해시 생성
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // deleted_accounts 체크
  const { data: deleted } = await supabase
    .from('deleted_accounts')
    .select('*')
    .eq('email_hash', hashHex)
    .single();
  
  if (deleted && !deleted.auth_deleted_at) {
    console.log('❌ 아직 30일이 지나지 않았습니다');
  } else if (deleted) {
    console.log('✅ 재가입 가능합니다');
  } else {
    console.log('✅ 신규 가입입니다');
  }
}

// 테스트 실행
await testReregistration('test1@example.com');
```

## 🚨 문제 해결

### 1. RPC 함수 실행 권한 오류
```sql
-- service_role 권한 확인
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'process_account_deletions';

-- 권한 재부여
GRANT EXECUTE ON FUNCTION process_account_deletions() TO service_role;
GRANT EXECUTE ON FUNCTION process_account_deletions() TO postgres;
```

### 2. Auth 삭제 실패
- Service key가 맞는지 확인
- auth.users에 해당 ID가 존재하는지 확인
- Supabase 대시보드에서 Auth > Users 확인

### 3. GitHub Actions 실패
- Secrets가 올바르게 설정되었는지 확인
- 로그에서 구체적인 에러 메시지 확인
- 수동으로 워크플로우 재실행

## 📊 모니터링 대시보드 SQL

```sql
-- 일별 처리 현황
SELECT 
  DATE(executed_at) as date,
  SUM(anonymized_count) as total_anonymized,
  SUM(deleted_auth_count) as total_deleted,
  SUM(error_count) as total_errors
FROM deletion_job_logs
WHERE executed_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(executed_at)
ORDER BY date DESC;

-- 대기 중인 탈퇴 계정
SELECT 
  COUNT(*) FILTER (WHERE deleted_at > NOW() - INTERVAL '30 days') as pending_30d,
  COUNT(*) FILTER (WHERE deleted_at <= NOW() - INTERVAL '30 days') as ready_to_process,
  COUNT(*) FILTER (WHERE email LIKE 'deleted-%') as already_processed
FROM profiles
WHERE deleted_at IS NOT NULL;
```

## ✅ 프로덕션 체크리스트

- [ ] 모든 마이그레이션 실행 완료
- [ ] GitHub Secrets 설정 완료
- [ ] Dry run 테스트 성공
- [ ] 테스트 데이터로 전체 프로세스 검증
- [ ] 에러 알림 설정 (Slack/Discord/Email)
- [ ] 모니터링 대시보드 구축
- [ ] 백업 계획 수립

---

테스트 완료 후 문제가 없으면 GitHub Actions 스케줄이 매일 새벽 3시(KST)에 자동 실행됩니다.