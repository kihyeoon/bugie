# 2026-03-02 거래 지출자(paid_by) 필드 추가

## 배경

현재 `transactions` 테이블에는 `created_by`(입력자) 필드만 존재한다.
공유 가계부 특성상 **"누가 앱에 기록했는지"**와 **"누가 실제로 돈을 썼는지"**는 다를 수 있다.

> 예: 아내가 남편 카드로 결제하고 아내가 앱에 입력한 경우
> - `created_by` = 아내 (입력자)
> - `paid_by` = 남편 (실제 지출자) ← 현재 없음

## 현재 상태

### 이미 있는 것

- `transactions.created_by` — 거래를 앱에 입력한 사람 (Supabase 세션 user.id 자동 설정)
- `active_transactions` 뷰에서 `created_by_name`으로 이름 표시
- `LedgerContext`의 `currentLedger.ledger_members` — 가계부 멤버 목록 접근 가능

### 없는 것

- 실제 지출자를 나타내는 필드
- 거래 입력/수정 UI에서 멤버 선택 기능

## 설계

### 컬럼명: `paid_by`

| 후보 | 의미 | 판단 |
|------|------|------|
| `paid_by` | 돈을 지불한 사람 | **채택** — 직관적 |
| `spent_by` | 돈을 쓴 사람 | 가능하지만 덜 일반적 |
| `member_id` | 관련 멤버 | 모호함 |

### 설계 포인트

- **nullable**: 기존 데이터 호환을 위해 nullable. `NULL`이면 `created_by`와 동일인으로 간주
- **FK 참조**: `profiles(id)`, `ON DELETE SET NULL` (탈퇴 사용자 대응)
- **기본값 로직**: 입력 시 `paid_by`를 선택하지 않으면 현재 로그인 유저로 자동 설정
- **UI 데이터**: `useLedger()`의 `currentLedger.ledger_members`로 멤버 목록 조회 가능 (추가 API 불필요)

## 변경 범위

클린 아키텍처 7개 레이어를 순서대로 수정해야 한다.

| # | 레이어 | 파일 | 변경 내용 |
|---|--------|------|-----------|
| 1 | DB 마이그레이션 | `supabase/migrations/새파일.sql` | `ALTER TABLE transactions ADD paid_by uuid REFERENCES profiles(id) ON DELETE SET NULL` |
| 2 | DB 뷰 | 같은 마이그레이션 | `active_transactions` 뷰에 `paid_by`, `paid_by_name` JOIN 추가 |
| 3 | Generated Types | `packages/types/src/database-generated.ts` | `transactions` Row/Insert/Update에 `paid_by` 필드 추가 |
| 4 | 도메인 타입 | `packages/core/src/domain/transaction/types.ts` | `TransactionEntity`, `CreateTransactionCommand`, `UpdateTransactionCommand`에 `paidBy` 추가 |
| 5 | 애플리케이션 타입 | `packages/core/src/application/transaction/types.ts` | `CreateTransactionInput`, `UpdateTransactionInput`에 `paidBy` 추가 |
| 6 | 매퍼/Repository | `packages/core/src/infrastructure/supabase/` | `paid_by` ↔ `paidBy` 매핑, DB 저장/조회 처리 |
| 7 | UI (Native) | `apps/native/app/(tabs)/add.tsx`, `transaction-detail.tsx` | 멤버 선택 UI 추가 |

### 상세 변경 사항

#### 1. DB 마이그레이션

```sql
ALTER TABLE transactions
  ADD COLUMN paid_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
```

#### 2. active_transactions 뷰 재생성

`profiles` 테이블을 한 번 더 JOIN하여 `paid_by_name` 노출:

```sql
LEFT JOIN profiles p2 ON t.paid_by = p2.id
-- SELECT 절에 추가: t.paid_by, p2.full_name AS paid_by_name
```

#### 3. 도메인 타입 변경

```typescript
// TransactionEntity
paidBy?: EntityId;

// CreateTransactionCommand
paidBy?: EntityId;

// UpdateTransactionCommand
paidBy?: EntityId;
```

#### 4. 애플리케이션 타입 변경

```typescript
// CreateTransactionInput
paidBy?: string;

// UpdateTransactionInput
paidBy?: string;
```

#### 5. UI 응답 타입 변경

```typescript
// TransactionWithDetails
paid_by: string | null;
paid_by_name: string | null;
```

#### 6. UI — 멤버 선택

- `add.tsx`: 카테고리 선택과 유사한 형태로 멤버 선택 UI 추가
- `transaction-detail.tsx`: 지출자 표시 및 수정 기능 추가
- 데이터 소스: `currentLedger.ledger_members`
