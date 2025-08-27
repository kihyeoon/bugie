# RLS와 Soft Delete 충돌 문제 해결

## 📋 문제 개요

Supabase에서 soft delete 실행 시 RLS(Row Level Security) 정책 위반 오류가 발생하는 문제입니다.
이 문제는 **categories**, **transactions**, **profiles** 테이블 모두에서 동일하게 발생했습니다.

**오류 메시지**: `"new row violates row-level security policy for table '테이블명'"`

## 🔍 근본 원인

### Supabase 클라이언트의 숨겨진 동작

```typescript
// 개발자가 작성한 코드
await supabase
  .from('categories')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', categoryId);

// Supabase가 실제로 실행하는 SQL
UPDATE categories 
SET deleted_at = NOW() 
WHERE id = 'xxx'
RETURNING *;  // 👈 자동으로 추가됨!
```

### 문제 발생 메커니즘

1. **UPDATE 실행**: `deleted_at` 값 설정
2. **RETURNING 절 자동 추가**: Supabase 클라이언트가 변경된 행 반환 시도
3. **SELECT 권한 체크**: RLS 정책의 `deleted_at IS NULL` 조건
4. **권한 위반**: 방금 삭제 처리한 행을 SELECT 할 수 없음
5. **오류 발생**

## 📊 테이블별 세부사항

| 테이블 | RLS 정책 형태 | 실패 지점 | 특이사항 |
|--------|--------------|-----------|----------|
| **categories** | 개별 정책 (SELECT, UPDATE 분리) | RETURNING의 SELECT 단계 | SELECT 정책에 `deleted_at IS NULL` |
| **transactions** | FOR ALL 단일 정책 | UPDATE의 WITH CHECK 단계 | 암묵적 WITH CHECK에 `deleted_at IS NULL` |
| **profiles** | FOR ALL + SELECT 혼합 | RETURNING의 SELECT 단계 | profiles_own_all의 USING 절 문제 |

## ✅ 통일된 해결책: RPC 함수 패턴

모든 테이블에 동일한 패턴의 RPC 함수를 생성하여 해결했습니다.

### 기본 패턴

```sql
CREATE OR REPLACE FUNCTION soft_delete_테이블명(...)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- RLS 우회
SET search_path = public
AS $$
BEGIN
  -- 권한 확인 로직
  
  -- Soft delete 수행 (RETURNING 없이!)
  UPDATE 테이블명
  SET deleted_at = NOW()
  WHERE 조건;
  
  RETURN true;
END;
$$;
```

### 클라이언트 코드

```typescript
// 기존 방식 (문제 발생)
await supabase.from('테이블').update({ deleted_at: ... });

// 해결 방식 (RPC 함수 사용)
await supabase.rpc('soft_delete_테이블명', { ... });
```

## 🎯 핵심 교훈

1. **Supabase 클라이언트는 자동으로 RETURNING 절을 추가**
   - `.update()` 후 결과를 반환받으려 시도
   - 이는 RLS의 SELECT 권한 체크를 트리거

2. **`deleted_at IS NULL`과 Soft Delete는 구조적으로 충돌**
   - RLS 정책 형태와 무관하게 발생
   - FOR ALL이든 개별 정책이든 동일한 문제

3. **SECURITY DEFINER 함수가 가장 안정적인 해결책**
   - RLS 완전 우회
   - RETURNING 절 제어 가능
   - 일관된 패턴으로 유지보수 용이

## 🔧 관련 마이그레이션 파일

- `20250816_create_soft_delete_category_function.sql` - Categories RPC 함수
- `20250821_create_soft_delete_transaction_function.sql` - Transactions RPC 함수
- `20250826_create_soft_delete_profile_function.sql` - Profiles RPC 함수

## 📚 참고 자료

- [Supabase RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS 문서](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

**중요**: 이 문제는 Supabase를 사용하는 프로젝트에서 흔히 발생할 수 있습니다.
Soft delete 패턴 사용 시 반드시 RLS와의 상호작용을 고려해야 합니다.

마지막 업데이트: 2025-08-26