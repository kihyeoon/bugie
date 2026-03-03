# PostgreSQL 보안 가이드 (Supabase + RLS)

## 1. SECURITY DEFINER vs SECURITY INVOKER

PostgreSQL 뷰는 두 가지 보안 모드로 실행된다.

### SECURITY DEFINER (기본값)

```
사용자 → 뷰 쿼리 → [뷰 소유자 권한으로 실행] → 테이블 데이터 (전체)
```

- 뷰를 만든 **소유자**(보통 `postgres` superuser)의 권한으로 실행
- RLS 정책이 **무시**됨 — 모든 행이 보임

### SECURITY INVOKER

```
사용자 → 뷰 쿼리 → [호출한 사용자 권한으로 실행] → RLS 필터 → 허용된 데이터만
```

- 뷰를 **호출한 사용자**의 권한으로 실행
- RLS 정책이 **정상 적용**됨

### 설정 방법

```sql
-- 기존 뷰의 보안 모드 변경 (DROP/CREATE 없이)
ALTER VIEW active_transactions SET (security_invoker = on);
```

### 핵심

뷰는 테이블을 감싸는 쿼리인데, 그 쿼리를 **누구의 권한**으로 실행하느냐의 차이다.
RLS는 테이블에 설정되어 있으므로, "누구로서 접근하느냐"에 따라 RLS가 적용되거나 무시된다.

---

## 2. RLS (Row Level Security)

### 개념

테이블의 **행 단위** 접근 제어. 각 행마다 "이 사용자가 이 행에 접근할 수 있는가"를 판단한다.

### Supabase에서 필수인 이유

Supabase는 클라이언트가 DB에 **직접 접근**하는 구조:

```
클라이언트 → Supabase (PostgREST) → PostgreSQL
              별도 백엔드 없음         RLS가 보안 담당
```

백엔드가 없으니 DB 자체가 "누가 뭘 볼 수 있는지"를 판단해야 한다.

### 백엔드가 있는 프로젝트와의 차이

```
클라이언트 → 백엔드 (Express 등) → PostgreSQL
              여기서 권한 체크       DB는 신뢰된 연결
```

백엔드가 비즈니스 로직으로 권한을 검증한 뒤 DB에 쿼리를 보내므로 RLS가 불필요하다.

| | Supabase (BaaS) | 백엔드 있는 프로젝트 |
|---|---|---|
| DB 접근 주체 | 클라이언트 (직접) | 백엔드 (대리) |
| 권한 검증 위치 | DB (RLS) | 백엔드 코드 |
| RLS 사용 | 필수 | 거의 안 씀 |

---

## 3. Bugie의 RLS 정책 구조

모든 정책이 **`ledger_members` 테이블**을 기준으로 동작한다:

```
ledger_members (user_id = auth.uid())
    ↓ 멤버십 확인
    ├── transactions  → 해당 가계부 거래만
    ├── ledgers       → 해당 가계부만
    ├── categories    → 해당 가계부 카테고리만
    ├── budgets       → 해당 가계부 예산만
    └── profiles      → 같은 가계부 멤버 프로필만
```

### 뷰별 RLS 매핑

**active_transactions 뷰**:

| JOIN 대상 | RLS 정책 | 허용 조건 |
|-----------|----------|-----------|
| `transactions` | `transactions_policy` | 내가 멤버인 가계부의 거래 |
| `ledgers` | `ledgers_policy` | 내가 멤버인 가계부 |
| `categories` (via category_details) | `categories_policy` | 내가 멤버인 가계부의 카테고리 |
| `category_templates` | `category_templates_select_policy` | 누구나 SELECT 가능 |
| `profiles` (created_by, paid_by) | `profiles_ledger_members_select` | 본인 OR 같은 가계부 멤버 |

**budget_vs_actual 뷰**:

| JOIN 대상 | RLS 정책 | 허용 조건 |
|-----------|----------|-----------|
| `budgets` | `budgets_policy` | 내가 멤버인 가계부의 예산 |
| `categories` (via category_details) | `categories_policy` | 내가 멤버인 가계부의 카테고리 |
| `transactions` (서브쿼리) | `transactions_policy` | 내가 멤버인 가계부의 거래 |

**ledger_monthly_summary 뷰**: `transactions` → `transactions_policy`만 사용.

**category_details 뷰**: `categories` + `category_templates` (전체 공개).

---

## 4. 주요 정책 상세 분석

### ledgers_policy

```sql
CREATE POLICY "ledgers_policy" ON ledgers
FOR ALL USING (
  deleted_at IS NULL AND
  id IN (
    SELECT ledger_id FROM ledger_members
    WHERE user_id = auth.uid() AND deleted_at IS NULL
  )
);
```

| 라인 | 의미 |
|------|------|
| `ON ledgers` | `ledgers` 테이블에 적용 |
| `FOR ALL` | SELECT, INSERT, UPDATE, DELETE 모든 연산에 적용 |
| `USING (...)` | 이 조건을 만족하는 행만 접근 가능 |
| `deleted_at IS NULL` | soft delete된 가계부 제외 |
| `id IN (SELECT ...)` | 이 가계부 id가 서브쿼리 결과에 포함되는지 확인 |
| `user_id = auth.uid()` | 현재 로그인한 사용자가 멤버인 것만 |

**한 줄 요약**: "내가 멤버로 속한 가계부만 접근 가능"

### profiles_ledger_members_select

```sql
CREATE POLICY "profiles_ledger_members_select" ON profiles
FOR SELECT USING (
  deleted_at IS NULL AND (
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1
      FROM ledger_members lm1
      INNER JOIN ledger_members lm2 ON lm1.ledger_id = lm2.ledger_id
      WHERE lm1.user_id = auth.uid()
        AND lm2.user_id = profiles.id
        AND lm1.deleted_at IS NULL
        AND lm2.deleted_at IS NULL
    )
  )
);
```

| 라인 | 의미 |
|------|------|
| `ON profiles` | `profiles` 테이블에 적용 |
| `FOR SELECT` | 조회만 허용 (수정/삭제는 별도 정책) |
| `auth.uid() = id` | 조건 1: 내 자신의 프로필은 항상 볼 수 있음 |
| `OR EXISTS (...)` | 조건 2: 아래 서브쿼리 결과가 존재하면 허용 |
| `FROM ledger_members lm1` | lm1 = 나의 멤버십 레코드 |
| `INNER JOIN ledger_members lm2` | lm2 = 상대방의 멤버십 레코드 |
| `ON lm1.ledger_id = lm2.ledger_id` | 같은 가계부에 속한 경우만 JOIN |
| `lm1.user_id = auth.uid()` | lm1이 나인지 확인 |
| `lm2.user_id = profiles.id` | lm2가 조회 대상 프로필인지 확인 |

**한 줄 요약**: "내 프로필 + 나와 같은 가계부에 속한 멤버의 프로필만 조회 가능"

---

## 5. Self Join 패턴

같은 테이블을 자기 자신과 JOIN하는 것을 **Self Join**이라고 한다.

### 동작 원리

`ledger_members` 테이블에 3명이 같은 가계부에 속해있을 때:

```
| ledger_id | user_id |
|-----------|---------|
| A         | 나      |
| A         | 배우자  |
| A         | 어머니  |
```

`ON lm1.ledger_id = lm2.ledger_id` 결과 — 모든 조합이 생성된다:

```
| lm1.user_id | lm2.user_id | ledger_id |
|-------------|-------------|-----------|
| 나          | 나          | A         |
| 나          | 배우자      | A         |
| 나          | 어머니      | A         |
| 배우자      | 나          | A         |
| 배우자      | 배우자      | A         |
| ...         | ...         | ...       |
```

3명이면 3×3 = 9행. 여기서 WHERE 조건으로 필요한 쌍만 걸러낸다.

### EXISTS와 함께 쓰는 이유

`profiles_ledger_members_select` 정책에서 `EXISTS`로 감싸는 이유:

- 행이 몇 개 나오는지는 중요하지 않고, **하나라도 존재하는지**만 확인
- `SELECT 1`은 "행 존재 여부만 확인"하는 관용 표현
- `EXISTS`는 첫 번째 매칭 행을 찾는 즉시 true를 반환하고 멈춤 → 성능 효율적

### Self Join이 흔히 쓰이는 경우

"같은 그룹에 속한 다른 사람 찾기" 패턴:

```sql
-- 같은 팀 동료
FROM team_members tm1
JOIN team_members tm2 ON tm1.team_id = tm2.team_id
WHERE tm1.user_id = '나' AND tm2.user_id = '상대'

-- 같은 수업 듣는 학생
FROM enrollments e1
JOIN enrollments e2 ON e1.course_id = e2.course_id
WHERE e1.student_id = '나' AND e2.student_id = '상대'
```

공통점: **관계 테이블을 통해 두 엔티티가 연결되어 있는지 확인**하는 것.

---

## 관련 마이그레이션 파일

| 파일 | 내용 |
|------|------|
| `20250729000001_initial_schema.sql` | transactions_policy, budgets_policy, ledgers_policy 등 기본 RLS |
| `20250816000002_fix_categories_rls_policy.sql` | categories SELECT 정책 수정 |
| `20250822000001_fix_profiles_rls_for_ledger_members.sql` | profiles_ledger_members_select 정책 추가 |
| `20260303000001_fix_active_transactions_security.sql` | 4개 뷰 SECURITY INVOKER 전환 |
