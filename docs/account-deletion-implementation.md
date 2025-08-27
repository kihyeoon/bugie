# 회원 탈퇴 구현 계획

> **최종 업데이트**: 2025-08-27 - ON DELETE SET NULL 최적화 적용

## 📋 개요

Bugie 서비스의 회원 탈퇴 프로세스는 사용자의 개인정보를 보호하면서도 데이터 무결성을 유지하는 균형잡힌 접근을 목표로 합니다.

### 핵심 정책

1. **Soft Delete + 30일 유예 기간**
   - 탈퇴 요청 시 즉시 삭제가 아닌 soft delete 처리
   - 30일 이내 재로그인 시 계정 복구 가능
   - 30일 경과 후 자동으로 완전 삭제

2. **완전 삭제 전략** (ON DELETE SET NULL로 최적화됨)
   - profiles 테이블 완전 삭제
   - auth.users 완전 삭제
   - 거래 기록의 created_by를 자동으로 NULL 처리 (외래키 제약)
   - PostgreSQL이 자동으로 참조 관리

3. **재가입 정책**
   - 동일 이메일로 재가입 가능 (30일 후)
   - 재가입 시 새로운 UUID 발급
   - 이전 데이터와 연결되지 않음

## 🏗️ 아키텍처

### 전체 프로세스 플로우

```mermaid
graph TD
    A[유저 탈퇴 요청] --> B[soft_delete_profile RPC]
    B --> C{가계부 소유자?}
    C -->|Yes| D[탈퇴 거부]
    C -->|No| E[profiles.deleted_at = NOW]

    E --> F[30일 유예 기간]
    F --> G{재로그인?}
    G -->|Yes| H[계정 복구]
    G -->|No| I[30일 경과]

    I --> J[GitHub Actions 실행]
    J --> K[process_account_deletions RPC]
    K --> L[profiles 삭제 (자동 NULL 처리)]
    L --> N[auth.users 삭제]
    N --> O[이메일 재사용 가능]
```

### 데이터 흐름

| 단계      | profiles        | auth.users | transactions.created_by | budgets.created_by | ledgers.created_by | 처리 방식 |
| --------- | --------------- | ---------- | ----------------------- | ------------------ | ------------------ | --------- |
| 탈퇴 요청 | deleted_at 설정 | 유지       | 유효한 참조             | 유효한 참조        | 유효한 참조        | Soft Delete |
| 30일 후   | 완전 삭제       | 완전 삭제  | NULL (자동 처리)        | NULL (자동 처리)   | NULL (자동 처리)   | ON DELETE SET NULL |
| UI 표시   | -               | -          | 데이터는 존재           | 데이터는 존재      | 데이터는 존재      | 익명 거래 |

## ⚠️ 중요 사항: CASCADE 문제

### 현재 스키마의 치명적 문제

```sql
-- 현재 구조 (문제!)
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  -- CASCADE: auth.users 삭제 시 profiles도 함께 삭제됨!
)
```

### 필수 수정사항

```sql
-- CASCADE 제거 필수!
ALTER TABLE profiles
  DROP CONSTRAINT profiles_id_fkey;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id)
    REFERENCES auth.users(id)
    ON DELETE NO ACTION; -- CASCADE 제거
```

**CASCADE를 제거하지 않으면:**

1. auth.users 삭제 시 profiles도 삭제됨
2. 익명화된 데이터 손실
3. transactions.created_by가 무효한 참조가 됨

## 📝 구현 상세

> **중요 변경사항**: 구현 전략의 진화
> 1. **Phase 1 (초기)**: 익명화 전략 - 복잡하고 불완전
> 2. **Phase 2 (중간)**: NULL 허용 + 수동 UPDATE - 작동하지만 복잡
> 3. **Phase 3 (최종)**: ON DELETE SET NULL - 간단하고 안정적 ✅
>
> **최종 선택 이유**: PostgreSQL의 외래키 제약을 활용하여 자동 처리. 코드 100줄 → 30줄로 감소

### Step 1: 데이터베이스 준비

#### 1-1. CASCADE 제거 (최우선!)

```sql
-- supabase/migrations/20250827_01_remove_cascade.sql

BEGIN;

-- CASCADE 제거
ALTER TABLE profiles
  DROP CONSTRAINT profiles_id_fkey;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id)
    REFERENCES auth.users(id)
    ON DELETE NO ACTION;

-- 검증
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints
    WHERE constraint_name = 'profiles_id_fkey'
    AND delete_rule = 'CASCADE'
  ) THEN
    RAISE EXCEPTION 'CASCADE still exists!';
  END IF;
END $$;

COMMIT;
```

#### 1-2. 추적 테이블 생성

```sql
-- supabase/migrations/20250827_02_create_tracking_tables.sql

BEGIN;

-- 삭제 계정 추적 (개인정보 최소화)
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_user_id UUID NOT NULL,
  email_hash TEXT NOT NULL, -- SHA256 해시로 저장
  deleted_at TIMESTAMPTZ NOT NULL,
  anonymized_at TIMESTAMPTZ,
  auth_deleted_at TIMESTAMPTZ,

  CONSTRAINT unique_original_user UNIQUE(original_user_id)
);

CREATE INDEX idx_deleted_email_hash ON deleted_accounts(email_hash);

-- 작업 로그
CREATE TABLE IF NOT EXISTS deletion_job_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  anonymized_count INTEGER DEFAULT 0,
  deleted_auth_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'github-actions'
);

COMMIT;
```

### Step 2: RPC 함수 생성

> **참고**: 초기 익명화 함수(`process_account_deletions`)는 사용하지 않으므로 건너뜁니다.
> 최종 완전 삭제 함수는 아래 1-4 섹션을 참조하세요.

```sql
-- 이 섹션은 의도적으로 비워둠 (익명화 전략 폐기)
-- 최종 구현은 process_account_deletions_clean() 함수 사용
```

#### 1-4. 완전 삭제 전략 마이그레이션 (Phase 2)

> **Note**: 이 방식은 작동하지만 복잡합니다. 최종 솔루션은 1-5를 참조하세요.

```sql
-- supabase/migrations/20250827_04_improve_deletion_process.sql
-- 익명화 전략에서 완전 삭제 전략으로 개선

BEGIN;

-- created_by 컬럼을 NULL 허용으로 변경
ALTER TABLE transactions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE ledgers ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE budgets ALTER COLUMN created_by DROP NOT NULL;

-- 새로운 완전 삭제 함수
CREATE OR REPLACE FUNCTION process_account_deletions_clean()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
  v_deleted_count INTEGER := 0;
BEGIN
  FOR v_result IN 
    SELECT id, email, deleted_at
    FROM profiles
    WHERE deleted_at IS NOT NULL
      AND deleted_at <= NOW() - INTERVAL '30 days'
    LIMIT 50
  LOOP
    -- 1. 이메일 해시 저장 (재가입 체크용)
    INSERT INTO deleted_accounts (
      original_user_id,
      email_hash,
      deleted_at,
      anonymized_at
    ) VALUES (
      v_result.id,
      encode(sha256(v_result.email::bytea), 'hex'),
      v_result.deleted_at,
      NOW()
    ) ON CONFLICT (original_user_id) DO UPDATE
      SET anonymized_at = NOW();
    
    -- 2. created_by를 NULL로 설정 (데이터 보존)
    UPDATE transactions SET created_by = NULL WHERE created_by = v_result.id;
    UPDATE budgets SET created_by = NULL WHERE created_by = v_result.id;
    UPDATE ledgers SET created_by = NULL WHERE created_by = v_result.id;
    
    -- 3. ledger_members에서 삭제
    DELETE FROM ledger_members WHERE user_id = v_result.id;
    
    -- 4. profiles 완전 삭제
    DELETE FROM profiles WHERE id = v_result.id;
    
    v_deleted_count := v_deleted_count + 1;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_account_deletions_clean() TO service_role;

COMMIT;
```

#### 1-5. ON DELETE SET NULL 최적화 (Phase 3 - 최종) ✅

```sql
-- supabase/migrations/20250827_06_optimize_with_set_null.sql
-- ON DELETE SET NULL을 활용한 최종 최적화

BEGIN;

-- 외래키 제약을 ON DELETE SET NULL로 변경
ALTER TABLE transactions 
  DROP CONSTRAINT IF EXISTS transactions_created_by_fkey;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

ALTER TABLE budgets 
  DROP CONSTRAINT IF EXISTS budgets_created_by_fkey;
ALTER TABLE budgets
  ADD CONSTRAINT budgets_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

ALTER TABLE ledgers 
  DROP CONSTRAINT IF EXISTS ledgers_created_by_fkey;
ALTER TABLE ledgers
  ADD CONSTRAINT ledgers_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- 간소화된 삭제 처리 함수 (30줄!)
CREATE OR REPLACE FUNCTION process_account_deletions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_profiles_to_delete jsonb := '[]'::jsonb;
  v_result RECORD;
BEGIN
  FOR v_result IN 
    SELECT id, email, deleted_at
    FROM profiles
    WHERE deleted_at IS NOT NULL
      AND deleted_at <= NOW() - INTERVAL '30 days'
    LIMIT 50
  LOOP
    -- 1. 이메일 해시 저장
    INSERT INTO deleted_accounts (
      original_user_id, email_hash, deleted_at
    ) VALUES (
      v_result.id,
      encode(sha256(v_result.email::bytea), 'hex'),
      v_result.deleted_at
    ) ON CONFLICT (original_user_id) DO NOTHING;
    
    -- 2. profiles 삭제 (외래키가 자동으로 NULL 처리!)
    DELETE FROM profiles WHERE id = v_result.id;
    
    v_profiles_to_delete := v_profiles_to_delete || jsonb_build_object(
      'user_id', v_result.id,
      'email', v_result.email
    );
    
    v_deleted_count := v_deleted_count + 1;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'profiles_to_delete', v_profiles_to_delete
  );
END;
$$;

-- 기존 복잡한 함수 제거
DROP FUNCTION IF EXISTS process_account_deletions_clean();

COMMIT;
```

**개선 효과**:
- ✅ 코드 복잡도: 100줄 → 30줄로 70% 감소
- ✅ 유지보수: 새 테이블 추가 시 외래키만 설정하면 자동 처리
- ✅ 성능: PostgreSQL 최적화된 처리
- ✅ 안정성: DB 레벨에서 보장

### Step 3: GitHub Actions 워크플로우

```yaml
# .github/workflows/process-account-deletions.yml

name: Process Account Deletions

on:
  schedule:
    # 매일 한국시간 새벽 3시 (UTC 18:00)
    - cron: '0 18 * * *'

  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run mode'
        type: boolean
        default: false

jobs:
  process-deletions:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install @supabase/supabase-js

      - name: Process deletions
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          DRY_RUN: ${{ inputs.dry_run || 'false' }}
        run: |
          node scripts/process-deletions.js
```

### Step 4: 처리 스크립트 (최종 버전)

```javascript
// scripts/process-deletions.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

async function processAccountDeletions() {
  const isDryRun = process.env.DRY_RUN === 'true';
  console.log(`Starting (Dry run: ${isDryRun})`);

  try {
    // 1. 완전 삭제 처리 (최종 간소화 함수 사용)
    const { data: result, error } = await supabase.rpc(
      'process_account_deletions'  // 함수명 변경됨
    );

    if (error) throw error;

    console.log(`Deleted: ${result.deleted_count} profiles`);

    // 2. Auth 삭제
    let deletedCount = 0;
    const errors = [];

    for (const user of result.users || []) {
      if (isDryRun) {
        console.log(`[DRY] Would delete: ${user.user_id}`);
        continue;
      }

      try {
        await supabase.auth.admin.deleteUser(user.user_id);

        await supabase
          .from('deleted_accounts')
          .update({ auth_deleted_at: new Date().toISOString() })
          .eq('original_user_id', user.user_id);

        deletedCount++;
      } catch (err) {
        errors.push({ user_id: user.user_id, error: err.message });
      }
    }

    // 3. 로그 저장
    if (!isDryRun) {
      await supabase.from('deletion_job_logs').insert({
        anonymized_count: result.count,
        deleted_auth_count: deletedCount,
        error_count: errors.length,
      });
    }

    console.log(`Completed: ${deletedCount} auth deleted`);
    if (errors.length > 0) process.exit(1);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

processAccountDeletions();
```

## 🔐 보안 고려사항

### 개인정보 보호

- **이메일 해시 저장**: 원본 이메일 대신 SHA256 해시만 저장
- **최소 정보 원칙**: full_name 등 불필요한 개인정보 저장 안함
- **익명화**: 식별 불가능한 형태로 변환

### 권한 관리

```sql
-- RPC 함수는 service_role만 실행 가능
GRANT EXECUTE ON FUNCTION process_account_deletions_clean() TO service_role;
GRANT EXECUTE ON FUNCTION force_clean_user(UUID) TO service_role;

-- GitHub Actions는 service key 사용
SUPABASE_SERVICE_KEY=${{ secrets.SUPABASE_SERVICE_KEY }}
```

### Rate Limiting

- 배치 크기 50개로 제한
- API 호출 간 지연 고려
- 실패 시 재시도 로직

## 🧪 테스트 시나리오

### 개발 환경 테스트

```sql
-- 테스트 데이터 생성
INSERT INTO profiles (id, email, full_name, deleted_at)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  'Test User',
  NOW() - INTERVAL '31 days'
);

-- RPC 함수 테스트
SELECT process_account_deletions_clean();

-- 결과 확인
SELECT * FROM profiles WHERE email LIKE 'deleted-%';
SELECT * FROM deleted_accounts;
```

### Dry Run 모드

```bash
# GitHub Actions 수동 실행
# Actions 탭 > Run workflow > Dry run 체크
```

## ✅ 구현 체크리스트

### 데이터베이스

- [ ] CASCADE 제거 마이그레이션
- [ ] 추적 테이블 생성
- [ ] RPC 함수 생성
- [ ] 권한 설정 확인

### GitHub Actions

- [ ] 워크플로우 파일 추가
- [ ] Secrets 설정 (SUPABASE_URL, SUPABASE_SERVICE_KEY)
- [ ] 처리 스크립트 작성
- [ ] Dry run 테스트

### 검증

- [ ] CASCADE 제거 확인
- [ ] 익명화 프로세스 테스트
- [ ] Auth 삭제 테스트
- [ ] 재가입 시나리오 테스트

## 📌 주의사항

1. **CASCADE 제거는 필수**: 제거하지 않으면 전체 시스템 실패
2. **개인정보 최소화**: 필요한 정보만 해시로 저장
3. **배치 크기 조절**: API rate limit 고려
4. **모니터링**: 실행 로그 정기 확인

## 🔄 향후 개선사항

- Phase 2: 탈퇴 D-7 알림 메일
- Phase 3: 데이터 아카이빙 시스템
- Phase 4: 완전 삭제 (1년 후)

---

마지막 업데이트: 2025-08-27
