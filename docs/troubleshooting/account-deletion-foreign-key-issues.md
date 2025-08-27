# 회원 탈퇴 시 auth.users 삭제 실패 문제 해결

## 📋 문제 개요

### 증상
- 30일 경과한 탈퇴 계정을 익명화 후 `auth.users`에서 삭제하려 할 때 실패
- 에러 메시지: `update or delete on table "users" violates foreign key constraint`

### 영향
- 익명화는 성공하지만 auth.users 테이블에 계정이 남아있음
- 동일 이메일로 재가입 불가능
- 30일 탈퇴 정책의 완전한 구현 실패

## 🔍 근본 원인 분석

### Supabase의 특수한 구조
```sql
-- Supabase의 profiles 테이블 구조
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  -- profiles.id가 auth.users.id와 동일한 값 사용
  email TEXT,
  full_name TEXT,
  -- ...
);
```

**핵심 문제**: `profiles.id`가 독립적인 UUID가 아니라 `auth.users.id`를 그대로 사용

### 외래키 순환 참조
```
auth.users
    ↑
    | (profiles.id FK)
    |
profiles
    ↑
    | (transactions.created_by FK)
    | (budgets.created_by FK)
    | (ledgers.created_by FK)
    |
관련 테이블들
```

### 삭제 시도 시 발생하는 문제
1. `auth.users` 삭제 시도
2. `profiles`가 참조하고 있어 실패
3. `profiles` 먼저 삭제 시도
4. `transactions`, `budgets`, `ledgers`가 참조하고 있어 실패

## 🛠️ 디버깅 과정

### 시도 1: 익명화 전략
```sql
-- profiles 데이터 유지하면서 익명화
UPDATE profiles SET 
  email = 'deleted-xxxxx@anon.local',
  full_name = '탈퇴한 사용자'
WHERE id = 'user-id';

-- auth.users 삭제 시도
DELETE FROM auth.users WHERE id = 'user-id';
-- 실패: profiles.id가 참조 중
```

**결과**: ❌ 실패 - 외래키 제약으로 삭제 불가

### 시도 2: 외래키 제약 임시 비활성화
```sql
-- 제약 비활성화 시도
ALTER TABLE profiles DISABLE TRIGGER ALL;
DELETE FROM auth.users WHERE id = 'user-id';
ALTER TABLE profiles ENABLE TRIGGER ALL;
```

**결과**: ❌ 실패 - Supabase RLS 및 보안 정책으로 불가

### 시도 3: CASCADE에서 NO ACTION으로 변경
```sql
ALTER TABLE profiles 
  DROP CONSTRAINT profiles_id_fkey;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE NO ACTION;
```

**결과**: ⚠️ 부분 성공 - CASCADE는 방지했지만 여전히 삭제 불가

### 시도 4: profiles 먼저 삭제
```sql
DELETE FROM profiles WHERE id = 'user-id';
-- 실패: transactions.created_by가 참조 중
```

**결과**: ❌ 실패 - 연쇄적인 외래키 참조

## ✅ 최종 해결 방법

### Phase 1: 전략 변경: 익명화 → 완전 삭제
외래키 참조를 끊기 위해 관련 테이블의 `created_by`를 NULL 허용으로 변경 (복잡함)

### Phase 2: ON DELETE SET NULL 최적화 (최종 선택) ✅
PostgreSQL의 외래키 제약을 활용하여 자동 처리

#### 최종 솔루션: 외래키 제약 변경
```sql
-- NO ACTION → SET NULL로 변경
ALTER TABLE transactions 
  DROP CONSTRAINT transactions_created_by_fkey;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- budgets, ledgers도 동일하게 처리
```

#### 간소화된 함수 (30줄!)
```sql
CREATE OR REPLACE FUNCTION process_account_deletions()
RETURNS json
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_result RECORD;
BEGIN
  FOR v_result IN 
    SELECT id, email FROM profiles
    WHERE deleted_at <= NOW() - INTERVAL '30 days'
    LIMIT 50
  LOOP
    -- 이메일 해시만 저장
    INSERT INTO deleted_accounts (original_user_id, email_hash, deleted_at)
    VALUES (v_result.id, encode(sha256(v_result.email::bytea), 'hex'), NOW());
    
    -- profiles 삭제 (외래키가 자동으로 NULL 처리!)
    DELETE FROM profiles WHERE id = v_result.id;
    
    v_deleted_count := v_deleted_count + 1;
  END LOOP;
  
  RETURN json_build_object('deleted_count', v_deleted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1단계: 테이블 스키마 수정 (Phase 1 방식)
```sql
-- created_by 컬럼을 NULL 허용으로 변경
ALTER TABLE transactions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE budgets ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE ledgers ALTER COLUMN created_by DROP NOT NULL;
```

### 2단계: 완전 삭제 함수 구현
```sql
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
    );
    
    -- 2. 관련 테이블의 created_by를 NULL로 (데이터는 보존)
    UPDATE transactions SET created_by = NULL WHERE created_by = v_result.id;
    UPDATE budgets SET created_by = NULL WHERE created_by = v_result.id;
    UPDATE ledgers SET created_by = NULL WHERE created_by = v_result.id;
    
    -- 3. ledger_members에서 삭제
    DELETE FROM ledger_members WHERE user_id = v_result.id;
    
    -- 4. profiles 완전 삭제 (이제 가능!)
    DELETE FROM profiles WHERE id = v_result.id;
    
    v_deleted_count := v_deleted_count + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'deleted_count', v_deleted_count);
END;
$$;
```

### 3단계: GitHub Actions에서 auth.users 삭제
```javascript
// scripts/process-deletions.js
const { data: result } = await supabase.rpc('process_account_deletions_clean');

// profiles가 삭제되었으므로 auth.users 삭제 가능
for (const profile of result.profiles_to_delete) {
  await supabase.auth.admin.deleteUser(profile.user_id);
}
```

## 📊 전후 비교

### Before (익명화 전략)
| 테이블 | 30일 후 상태 | 문제점 |
|--------|------------|--------|
| profiles | 익명화된 데이터 유지 | 복잡함 |
| auth.users | ❌ 삭제 실패 | 외래키 제약 |
| transactions | created_by 유지 | 참조 충돌 |
| deleted_accounts | 이메일 해시 저장 | - |

### Phase 1 (수동 NULL 처리)
| 테이블 | 30일 후 상태 | 처리 방식 |
|--------|------------|-----------|
| profiles | ✅ 완전 삭제 | DELETE |
| auth.users | ✅ 완전 삭제 | DELETE |
| transactions | created_by = NULL | UPDATE 수동 |
| deleted_accounts | 이메일 해시 저장 | INSERT |

### Phase 2 - 최종 (ON DELETE SET NULL)
| 테이블 | 30일 후 상태 | 처리 방식 | 장점 |
|--------|------------|-----------|------|
| profiles | ✅ 완전 삭제 | DELETE | 간단 |
| auth.users | ✅ 완전 삭제 | DELETE | 자동 |
| transactions | created_by = NULL | 자동 처리 | DB가 관리 |
| deleted_accounts | 이메일 해시 저장 | INSERT | - |

## 💡 교훈 및 권장사항

### 0. MVP 개발 원칙
- **간단한 솔루션 우선**: ON DELETE SET NULL처럼 DB가 제공하는 기능 활용
- **과도한 엔지니어링 방지**: 복잡한 로직보다 시스템 기능 활용
- **코드 최소화**: 100줄 → 30줄로 줄일 수 있다면 그렇게 하라

### 1. Supabase 프로젝트 설계 시
- **독립적인 UUID 고려**: profiles.id를 독립적으로 생성하면 이런 문제 방지
  ```sql
  CREATE TABLE profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    -- ...
  );
  ```

### 2. 외래키 제약 설정
- **CASCADE 주의**: 의도하지 않은 데이터 손실 가능
- **NULL 허용 검토**: 향후 삭제 시나리오 고려
- **DEFERRABLE 옵션**: 복잡한 삭제 작업 시 유용

### 3. Soft Delete vs Hard Delete
| 전략 | 장점 | 단점 |
|------|------|------|
| Soft Delete + 익명화 | 데이터 완전 보존 | 외래키 관리 복잡 |
| Hard Delete + NULL FK | 깔끔한 삭제 | 일부 관계 정보 손실 |

### 4. 테스트 시나리오
```sql
-- 1. 테스트 사용자 생성
INSERT INTO auth.users (id, email) VALUES 
  (gen_random_uuid(), 'test@example.com');

-- 2. 프로필 생성 (동일 ID 사용)
INSERT INTO profiles (id, email, full_name, deleted_at)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@example.com'),
  'test@example.com',
  'Test User',
  NOW() - INTERVAL '31 days'
);

-- 3. 삭제 함수 실행
SELECT process_account_deletions_clean();

-- 4. 검증
SELECT COUNT(*) FROM profiles WHERE email = 'test@example.com'; -- 0
SELECT COUNT(*) FROM auth.users WHERE email = 'test@example.com'; -- 0
```

## 🔗 관련 파일
- `/supabase/migrations/20250827_01_remove_cascade.sql` - CASCADE 제거
- `/supabase/migrations/20250827_04_improve_deletion_process.sql` - Phase 1 해결
- `/supabase/migrations/20250827_06_optimize_with_set_null.sql` - Phase 2 최종 해결 ✅
- `/scripts/process-deletions.js` - GitHub Actions 스크립트
- `/.github/workflows/process-account-deletions.yml` - 자동화 워크플로우

## 📅 타임라인
- **2025-08-27 01:00** - 문제 발견: auth.users 삭제 실패
- **2025-08-27 02:00** - CASCADE 제거 시도
- **2025-08-27 03:00** - 익명화 전략 실패 확인
- **2025-08-27 04:00** - NULL 허용 전략으로 전환 (Phase 1)
- **2025-08-27 05:00** - 완전 삭제 구현 완료
- **2025-08-27 06:00** - ON DELETE SET NULL 최적화 (Phase 2) ✅

## ⚠️ 주의사항
1. **데이터 손실**: created_by가 NULL이 되면 누가 생성했는지 알 수 없음
2. **마이그레이션 순서**: CASCADE 제거 → 추적 테이블 → 삭제 함수 순서 중요
3. **프로덕션 적용**: 백업 후 적용, 롤백 계획 수립 필수