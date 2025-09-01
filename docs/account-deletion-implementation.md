# 회원 탈퇴 구현 계획

> **최종 업데이트**: 2025-08-28 - 용어 정리 및 중복 컬럼 제거 (anonymized → processed)

## 📋 개요

Bugie 서비스의 회원 탈퇴 프로세스는 사용자의 개인정보를 보호하면서도 데이터 무결성을 유지하는 균형잡힌 접근을 목표로 합니다.

### 핵심 정책

1. **Soft Delete + 30일 유예 기간**
   - 탈퇴 요청 시 즉시 삭제가 아닌 soft delete 처리
   - 30일 이내 재로그인 시 계정 복구 가능
   - 30일 경과 후 자동으로 완전 삭제

2. **즉시 처리 사항** (보안을 위한 즉각 조치)
   - **ledger_members 즉시 삭제**: 탈퇴 즉시 모든 가계부 접근 권한 제거
   - 탈퇴한 사용자는 즉시 가계부 접근 불가
   - ProfileService.deleteAccount()에서 처리

3. **완전 삭제 전략** (ON DELETE SET NULL로 최적화됨)
   - profiles 테이블 완전 삭제
   - auth.users 완전 삭제
   - 거래 기록의 created_by를 자동으로 NULL 처리 (외래키 제약)
   - PostgreSQL이 자동으로 참조 관리

4. **재가입 정책**
   - 동일 이메일로 재가입 가능 (30일 후)
   - 재가입 시 새로운 UUID 발급
   - 이전 데이터와 연결되지 않음

## 🏗️ 아키텍처

### 전체 프로세스 플로우

```mermaid
graph TD
    A[유저 탈퇴 요청] --> B[ProfileService.deleteAccount]
    B --> C{가계부 소유자?}
    C -->|Yes| D[탈퇴 거부]
    C -->|No| E[즉시: ledger_members 삭제]
    E --> F[즉시: profiles.deleted_at = NOW]

    F --> G[30일 유예 기간]
    G --> H{재로그인?}
    H -->|Yes| I[계정 복구]
    H -->|No| J[30일 경과]

    J --> K[GitHub Actions 실행]
    K --> L[process_account_deletions RPC]
    L --> M[ledger_members 재삭제 시도]
    M --> N[profiles 삭제 (자동 NULL 처리)]
    N --> O[auth.users 삭제]
    O --> P[이메일 재사용 가능]
```

### 데이터 흐름

| 단계      | profiles        | auth.users | ledger_members | transactions.created_by | budgets.created_by | ledgers.created_by | 처리 방식 |
| --------- | --------------- | ---------- | -------------- | ----------------------- | ------------------ | ------------------ | --------- |
| 탈퇴 요청 | deleted_at 설정 | 유지       | **즉시 삭제**  | 유효한 참조             | 유효한 참조        | 유효한 참조        | Soft Delete / Hard Delete |
| 30일 후   | 완전 삭제       | 완전 삭제  | CASCADE 재시도 | NULL (자동 처리)        | NULL (자동 처리)   | NULL (자동 처리)   | ON DELETE SET NULL / CASCADE |
| UI 표시   | -               | -          | -              | 데이터는 존재           | 데이터는 존재      | 데이터는 존재      | 익명 거래 |

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
2. 처리된 데이터 손실
3. transactions.created_by가 무효한 참조가 됨

## 📝 구현 상세

> **중요 변경사항**: 구현 전략의 진화
> 1. **Phase 1 (초기)**: 익명화 전략 - 복잡하고 불완전
> 2. **Phase 2 (중간)**: NULL 허용 + 수동 UPDATE - 작동하지만 복잡
> 3. **Phase 3 (최종)**: ON DELETE SET NULL - 간단하고 안정적 ✅
> 4. **Phase 4 (2025-08-28)**: 용어 정리 - anonymized → processed로 변경
> 5. **Phase 5 (현재)**: 즉시 삭제 로직 추가 - ledger_members 즉시 제거로 보안 강화
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
  auth_deleted_at TIMESTAMPTZ, -- auth.users에서 삭제된 시점

  CONSTRAINT unique_original_user UNIQUE(original_user_id)
);

CREATE INDEX idx_deleted_email_hash ON deleted_accounts(email_hash);

-- 작업 로그
CREATE TABLE IF NOT EXISTS deletion_job_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  profiles_processed INTEGER DEFAULT 0, -- 처리된 프로필 수
  deleted_auth_count INTEGER DEFAULT 0, -- auth.users에서 삭제된 수
  error_count INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'github-actions'
);

COMMIT;
```

### Step 2: RPC 함수 생성

> **참고**: 초기 익명화 전략은 폐기되었고, 완전 삭제 전략을 사용합니다.
> 최종 구현은 아래 섹션들을 참조하세요.

```sql
-- 이 섹션은 의도적으로 비워둠 (익명화 전략 폐기)
-- 최종 구현은 process_account_deletions() 함수 사용
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
      deleted_at
    ) VALUES (
      v_result.id,
      encode(sha256(v_result.email::bytea), 'hex'),
      v_result.deleted_at
    ) ON CONFLICT (original_user_id) DO UPDATE
      SET email_hash = EXCLUDED.email_hash;
    
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

-- ledger_members의 CASCADE 설정 (profiles 삭제 시 자동 삭제)
-- 참고: 이 설정은 이미 존재하지만 명시적으로 확인
ALTER TABLE ledger_members
  DROP CONSTRAINT IF EXISTS ledger_members_user_id_fkey;
ALTER TABLE ledger_members
  ADD CONSTRAINT ledger_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;  -- profiles 삭제 시 자동으로 멤버십도 삭제

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

#### 1-6. 용어 정리 및 중복 제거 (Phase 4 - 2025-08-28) ✅

```sql
-- supabase/migrations/20250828_cleanup_account_deletion_system.sql
-- 레거시 "익명화" 용어를 제거하고 실제 동작에 맞는 네이밍으로 변경

BEGIN;

-- 1. deleted_accounts 테이블 정리
-- anonymized_at 컬럼 제거 (auth_deleted_at과 중복)
ALTER TABLE deleted_accounts 
DROP COLUMN IF EXISTS anonymized_at;

-- 2. deletion_job_logs 테이블 정리
-- 컬럼명 변경: anonymized_count → profiles_processed
ALTER TABLE deletion_job_logs 
RENAME COLUMN anonymized_count TO profiles_processed;

-- 3. 테이블 및 컬럼 설명 추가
COMMENT ON TABLE deleted_accounts 
IS '탈퇴 요청된 계정 추적 (30일 유예 기간)';

COMMENT ON COLUMN deleted_accounts.deleted_at 
IS '탈퇴 요청 시점 (soft delete)';

COMMENT ON COLUMN deleted_accounts.auth_deleted_at 
IS '30일 후 auth.users에서 삭제된 시점';

COMMENT ON COLUMN deletion_job_logs.profiles_processed 
IS '성공적으로 처리된 프로필 수';

-- 4. process_account_deletions 함수는 이미 올바른 형태
-- (Phase 3에서 구현된 버전 유지)

COMMIT;
```

**개선 효과**:
- ✅ 코드 복잡도: 100줄 → 30줄로 70% 감소
- ✅ 유지보수: 새 테이블 추가 시 외래키만 설정하면 자동 처리
- ✅ 성능: PostgreSQL 최적화된 처리
- ✅ 안정성: DB 레벨에서 보장
- ✅ 명확성: 레거시 용어 제거로 코드 이해도 향상 (Phase 4)

### Step 3: 애플리케이션 레이어 구현

```typescript
// packages/core/src/application/profile/ProfileService.ts

async deleteAccount(input: DeleteAccountInput): Promise<void> {
  const currentUser = await this.authService.getCurrentUser();
  if (!currentUser) {
    throw new UnauthorizedError('인증이 필요합니다.');
  }

  // 소유한 가계부 확인 (다른 멤버가 있으면 탈퇴 불가)
  const ownedLedgersWithOtherMembers = // ... 체크 로직

  ProfileRules.canDeleteAccount(
    currentUser.id,
    ownedLedgersWithOtherMembers.length,
    sharedLedgers.length
  );

  // 1. 가계부 멤버십 즉시 제거 (보안상 중요!)
  await this.ledgerMemberRepo.removeUserFromAllLedgers(currentUser.id);

  // 2. 프로필 soft delete (30일 유예 기간 시작)
  await this.profileRepo.softDelete(currentUser.id);
  
  // 3. 로그아웃은 UI 레이어에서 처리
}
```

```typescript
// packages/core/src/infrastructure/supabase/repositories/LedgerRepository.ts

async removeUserFromAllLedgers(userId: EntityId): Promise<void> {
  const { error } = await this.supabase
    .from('ledger_members')
    .delete()  // 하드 삭제 (즉시 완전 삭제!)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`가계부 멤버십 제거 실패: ${error.message}`);
  }
}
```

### Step 4: GitHub Actions 워크플로우

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

### Step 5: 처리 스크립트 (최종 버전)

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
        profiles_processed: result.deleted_count || 0,
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
- **개인정보 제거**: created_by를 NULL로 설정하여 식별 불가능

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
- [ ] 완전 삭제 프로세스 테스트
- [ ] Auth 삭제 테스트
- [ ] 재가입 시나리오 테스트

## 📌 주의사항

1. **CASCADE 제거는 필수**: 제거하지 않으면 전체 시스템 실패
2. **ledger_members CASCADE는 유지**: profiles 삭제 시 자동으로 멤버십 삭제 필요
3. **즉시 삭제와 30일 후 삭제 중복**: 안전장치로 작동 (이미 없으면 무시)
4. **개인정보 최소화**: 필요한 정보만 해시로 저장
5. **배치 크기 조절**: API rate limit 고려
6. **모니터링**: 실행 로그 정기 확인

## 🔄 향후 개선사항

- Phase 2: 탈퇴 D-7 알림 메일
- Phase 3: 데이터 아카이빙 시스템
- Phase 4: 완전 삭제 (1년 후)

---

마지막 업데이트: 2025-09-01
- ledger_members 즉시 삭제 로직 추가
- CASCADE 설정 명시
- 실제 구현과 문서 동기화
