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

### 2단계: RLS 정책 분리

각 작업별로 정책을 분리하여 WITH CHECK 절을 명시적으로 추가:

```sql
-- SELECT 정책
CREATE POLICY "categories_select_policy" ON categories
FOR SELECT USING (
  deleted_at IS NULL AND
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);

-- UPDATE 정책 (WITH CHECK 절 추가)
CREATE POLICY "categories_update_policy" ON categories
FOR UPDATE 
USING (
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'member')
    AND deleted_at IS NULL
  )
)
WITH CHECK (
  ledger_id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'member')
    AND deleted_at IS NULL
  )
);
```

**그러나 문제는 여전히 발생!**

### 3단계: 진짜 원인 발견

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

## 🎯 핵심 교훈

### 1. Supabase 클라이언트의 숨겨진 동작
- `.update()` 메서드는 기본적으로 RETURNING 절을 추가
- `.select()`를 명시적으로 호출하지 않아도 결과를 반환받으려 시도

### 2. Soft Delete와 RLS의 상호작용
- Soft delete 패턴 사용 시 SELECT 정책의 `deleted_at IS NULL` 조건이 문제가 될 수 있음
- UPDATE 후 결과를 반환받을 때 충돌 발생

### 3. 해결 패턴
- **RPC 함수 사용**: SECURITY DEFINER로 RLS 우회, RETURNING 절 제어 가능
- **별도 API 엔드포인트**: Edge Functions 사용
- **클라이언트 로직 수정**: 결과를 반환받지 않도록 처리 (지원되는 경우)

## 🔧 관련 마이그레이션 파일

1. `20250816_fix_categories_rls_policy.sql` - RLS 정책 분리
2. `20250816_create_soft_delete_category_function.sql` - RPC 함수 생성
3. `20250816_fix_default_icon.sql` - 아이콘 기본값 수정

## 📚 참고 자료

- [PostgreSQL RLS 문서](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [Soft Delete 패턴과 RLS](https://github.com/supabase/supabase/discussions/topic)

---

이 문제는 Supabase를 사용하는 많은 프로젝트에서 발생할 수 있는 일반적인 이슈입니다. 
Soft delete 패턴을 사용할 때는 항상 이러한 상호작용을 고려해야 합니다.

마지막 업데이트: 2025-08-16