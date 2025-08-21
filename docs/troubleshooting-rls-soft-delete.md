# RLS와 Soft Delete 충돌 문제 해결 과정

## 📋 문제 상황

### 증상
- 카테고리 삭제(soft delete) 시도 시 오류 발생
- 오류 메시지: `"new row violates row-level security policy for table 'categories'"`
- 사용자는 정상적인 권한(owner)을 가지고 있음에도 불구하고 삭제 실패

### 초기 코드
```typescript
// CategoryBottomSheet.tsx
const { error } = await supabase
  .from('categories')
  .update({
    is_active: false,
    deleted_at: new Date().toISOString(),
  })
  .eq('id', contextMenuCategory.id);
```

## 🔍 문제 분석 과정

### 1단계: RLS 정책 확인

처음에는 RLS 정책에 문제가 있다고 판단했습니다.

**기존 RLS 정책 (categories_policy)**:
```sql
CREATE POLICY "categories_policy" ON categories FOR ALL USING (
  deleted_at IS NULL AND
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);
```

문제점: 단일 FOR ALL 정책으로 모든 작업을 처리하면 UPDATE 시 WITH CHECK 절이 누락될 수 있음

### 2단계: RLS 정책 분리 시도 (❌ 잘못된 접근)

⚠️ **주의: 이것은 잘못된 진단이었습니다!**

각 작업별로 정책을 분리하여 WITH CHECK 절을 명시적으로 추가했지만, 실제로는 문제 해결과 무관했습니다:

```sql
-- SELECT 정책 (👈 진짜 문제는 여기!)
CREATE POLICY "categories_select_policy" ON categories
FOR SELECT USING (
  deleted_at IS NULL AND  -- 이 조건이 RETURNING과 충돌
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);

-- UPDATE 정책 (WITH CHECK 절 추가 - 하지만 의미 없었음)
CREATE POLICY "categories_update_policy" ON categories
FOR UPDATE 
USING (
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'member')
    AND deleted_at IS NULL  -- 👈 이것은 ledger_members의 deleted_at
  )
)
WITH CHECK (
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'member')
    AND deleted_at IS NULL  -- 👈 categories의 deleted_at이 아님!
  )
);
```

**왜 이 접근이 실패했나?**
- WITH CHECK의 `deleted_at IS NULL`은 **ledger_members** 테이블의 것
- **categories** 테이블의 deleted_at과는 무관
- 진짜 문제는 UPDATE가 아닌 **SELECT 정책**에 있었음

### 3단계: 잘못된 진단 깨달음

**문제는 여전히 발생!** 그래서 다시 분석:

1. UPDATE는 실제로 성공하고 있었음
2. 문제는 UPDATE 이후 단계에서 발생
3. 에러 메시지를 다시 정확히 읽어보니...

### 4단계: 진짜 원인 발견

디버깅을 통해 발견한 사실:
1. 사용자 세션은 정상 (`user_id: 34be7025-4156-4f3e-a395-62db85520dfd`)
2. 권한도 정상 (`role: owner`)
3. RLS 정책도 올바르게 설정됨
4. **MCP를 통한 직접 SQL 실행 시 정상 작동**

#### 핵심 발견: Supabase JS 클라이언트의 동작

```typescript
// Supabase 클라이언트는 내부적으로 이렇게 동작
UPDATE categories 
SET is_active = false, deleted_at = NOW() 
WHERE id = 'xxx'
RETURNING *;  // 👈 자동으로 추가됨!
```

**문제의 흐름**:
1. UPDATE 실행 → `deleted_at` 설정
2. RETURNING 절이 변경된 행을 SELECT 시도
3. 하지만 SELECT 정책에 `deleted_at IS NULL` 조건이 있음
4. 방금 `deleted_at`을 설정한 행은 SELECT 권한이 없음
5. **오류 발생!**

## ✅ 해결 방법

### 방법 1: RPC 함수 사용 (채택된 해결책)

```sql
CREATE OR REPLACE FUNCTION soft_delete_category(category_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 권한 확인
  IF NOT EXISTS (
    SELECT 1 
    FROM categories c
    JOIN ledger_members lm ON c.ledger_id = lm.ledger_id
    WHERE c.id = category_id
    AND lm.user_id = auth.uid()
    AND lm.role IN ('owner', 'admin', 'member')
    AND lm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied to delete this category';
  END IF;

  -- Soft delete 수행 (RETURNING 없이)
  UPDATE categories
  SET 
    is_active = false,
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = category_id;

  RETURN true;
END;
$$;
```

**클라이언트 코드**:
```typescript
const { error } = await supabase.rpc('soft_delete_category', {
  category_id: contextMenuCategory.id
});
```

### 방법 2: SELECT 정책 수정 (대안)

SELECT 정책에서 `deleted_at IS NULL` 조건을 제거할 수 있지만, 이는 삭제된 데이터가 노출될 위험이 있습니다.

```sql
-- 권장하지 않음
CREATE POLICY "categories_select_policy" ON categories
FOR SELECT USING (
  -- deleted_at IS NULL 제거
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);
```

## 🔄 Transactions 테이블의 경우

Categories와 달리 Transactions 테이블은 다른 형태의 문제를 보였습니다:

### Categories vs Transactions 비교

| 구분 | Categories | Transactions |
|------|-----------|--------------|
| **RLS 정책 형태** | 개별 정책 (SELECT, UPDATE 등) | FOR ALL 단일 정책 |
| **실패 지점** | RETURNING의 SELECT 단계 | UPDATE의 WITH CHECK 단계 |
| **에러 발생 원인** | SELECT 정책의 `deleted_at IS NULL` | FOR ALL의 암묵적 WITH CHECK |
| **에러 메시지** | "new row violates..." (RETURNING 시) | "new row violates..." (UPDATE 시) |

### Transactions의 문제

```sql
-- Transactions의 RLS 정책
CREATE POLICY "transactions_policy" ON transactions 
FOR ALL USING (
  deleted_at IS NULL AND
  ledger_id IN (...)
);
```

**FOR ALL의 숨겨진 동작**:
```sql
-- FOR ALL은 내부적으로 이렇게 동작
FOR SELECT USING (deleted_at IS NULL ...)
FOR INSERT WITH CHECK (deleted_at IS NULL ...)  
FOR UPDATE USING (deleted_at IS NULL ...) 
          WITH CHECK (deleted_at IS NULL ...)  -- 👈 여기서 실패!
FOR DELETE USING (deleted_at IS NULL ...)
```

**실패 과정**:
1. UPDATE 시작: `deleted_at = NULL` → USING 통과 ✅
2. UPDATE 실행: `deleted_at = '2025-01-21...'` 설정
3. WITH CHECK 검증: `deleted_at IS NULL` 체크 → ❌ 실패!
4. RETURNING 단계까지 가지 못함

### 결론: 같은 해결책, 다른 원인

두 테이블 모두 SECURITY DEFINER 함수로 해결했지만, 원인은 달랐습니다:
- **Categories**: Supabase 클라이언트의 RETURNING + SELECT 정책
- **Transactions**: FOR ALL 정책의 WITH CHECK

## 🎯 핵심 교훈

### 1. 에러 메시지를 정확히 읽기
- "new row violates..." 에러는 여러 단계에서 발생 가능
- 정확한 실패 지점을 파악하는 것이 중요

### 2. RLS 정책 형태별 차이 이해
- **FOR ALL**: 모든 작업에 동일한 조건 적용 (WITH CHECK 포함)
- **개별 정책**: 각 작업별로 세밀한 제어 가능

### 3. Supabase 클라이언트의 숨겨진 동작
- `.update()` 메서드는 기본적으로 RETURNING 절을 추가
- `.select()`를 명시적으로 호출하지 않아도 결과를 반환받으려 시도

### 4. Soft Delete와 RLS의 구조적 충돌
- `deleted_at IS NULL` 조건은 Soft Delete와 근본적으로 충돌
- 어떤 형태의 RLS 정책이든 이 문제는 발생

### 5. 해결 패턴
- **RPC 함수 사용**: SECURITY DEFINER로 RLS 우회, RETURNING 절 제어 가능
- **별도 API 엔드포인트**: Edge Functions 사용
- **클라이언트 로직 수정**: 결과를 반환받지 않도록 처리 (지원되는 경우)

## 🔧 관련 마이그레이션 파일

1. `20250816_fix_categories_rls_policy.sql` - RLS 정책 분리 (잘못된 시도)
2. `20250816_create_soft_delete_category_function.sql` - Categories RPC 함수 생성
3. `20250821_create_soft_delete_transaction_function.sql` - Transactions RPC 함수 생성
4. `20250816_fix_default_icon.sql` - 아이콘 기본값 수정

## 📚 참고 자료

- [PostgreSQL RLS 문서](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [Soft Delete 패턴과 RLS](https://github.com/supabase/supabase/discussions/topic)

---

이 문제는 Supabase를 사용하는 많은 프로젝트에서 발생할 수 있는 일반적인 이슈입니다. 
Soft delete 패턴을 사용할 때는 항상 이러한 상호작용을 고려해야 합니다.

**중요**: 디버깅 과정에서의 실수도 문서화했습니다. 실패한 시도를 통해 배운 교훈이 더 가치있을 수 있습니다.

마지막 업데이트: 2025-08-21