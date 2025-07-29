# Supabase Migrations

이 디렉토리는 Bugie 프로젝트의 데이터베이스 마이그레이션 파일들을 포함합니다.

## 마이그레이션 파일 구조

```
20250729_001_initial_schema.sql      # 기본 테이블 및 RLS 정책
20250729_002_functions_and_triggers.sql  # 함수와 트리거
20250729_003_views.sql              # 뷰 정의
20250729_004_seed_category_templates.sql # 초기 카테고리 데이터
```

## 마이그레이션 실행 방법

### Supabase CLI가 있는 경우

```bash
# 마이그레이션 실행
supabase db push

# 특정 마이그레이션만 실행
supabase db push --file migrations/20250729_001_initial_schema.sql
```

### Supabase 대시보드 사용

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. SQL Editor 탭으로 이동
4. 각 마이그레이션 파일 내용을 순서대로 실행
   - `20250729_001_initial_schema.sql`
   - `20250729_002_functions_and_triggers.sql`
   - `20250729_003_views.sql`
   - `20250729_004_seed_category_templates.sql`

### Supabase MCP 사용 (현재 프로젝트)

```typescript
// 마이그레이션 적용
mcp__supabase__apply_migration({
  name: "initial_schema",
  query: /* SQL 내용 */
});
```

## 새로운 마이그레이션 생성

### 명명 규칙

```
YYYYMMDD_NNN_description.sql
```

- `YYYYMMDD`: 날짜
- `NNN`: 순서 번호 (001, 002, ...)
- `description`: 간단한 설명 (snake_case)

### 예시

```sql
-- 20250730_001_add_notifications_table.sql
CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  title text NOT NULL,
  message text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "notifications_policy" ON notifications
FOR ALL USING (user_id = auth.uid());
```

## 주의사항

1. **순서 중요**: 마이그레이션은 반드시 번호 순서대로 실행해야 합니다.
2. **멱등성**: 가능한 한 마이그레이션은 여러 번 실행해도 안전하도록 작성하세요.
   - `CREATE TABLE IF NOT EXISTS`
   - `ON CONFLICT DO NOTHING`
3. **롤백 계획**: 중요한 변경사항의 경우 롤백 SQL도 준비하세요.
4. **테스트**: 프로덕션 적용 전에 개발 환경에서 충분히 테스트하세요.

## 현재 데이터베이스 구조

### 테이블
- `profiles`: 사용자 프로필
- `ledgers`: 가계부
- `ledger_members`: 가계부 멤버십
- `categories`: 카테고리 (하이브리드)
- `category_templates`: 카테고리 템플릿
- `transactions`: 거래 내역
- `budgets`: 예산

### ENUM 타입
- `member_role`: owner, admin, member, viewer
- `category_type`: income, expense
- `budget_period`: monthly, yearly

### 주요 함수
- `setup_new_user()`: 새 사용자 초기 설정
- `activate_default_categories()`: 기본 카테고리 활성화
- `invite_member_to_ledger()`: 멤버 초대
- `get_ledger_monthly_stats()`: 월별 통계

### 뷰
- `category_details`: 카테고리 상세 정보
- `active_transactions`: 활성 거래 내역
- `ledger_monthly_summary`: 월별 요약
- `budget_vs_actual`: 예산 대비 실제 지출