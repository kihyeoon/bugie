# 결제 수단(Payment Methods) 아키텍처

## 1. 배경 및 목적

### 해결하려는 문제

기존 `paid_by`(지출자) 필드 하나로는 부부/가족 가계부에서 흔히 발생하는 상황을 정확히 표현할 수 없다.

- "같이 밥 먹고 남편 카드로 결제" — 공동 지출인데 지출자를 누구로?
- "남편 카드를 아내가 들고 가서 결제" — 카드 소유자 ≠ 실제 결제자
- "이번 달 카드값 얼마지?" — 결제 수단별 통계 불가

### 설계 원칙

- **paid_by**의 기존 의미("NULL이면 작성자와 동일")를 유지한다. 의미 재정의 없이 `payment_method_id`만 추가한다.
- **결제 수단**을 별도 엔티티로 분리하여, 어떤 카드/통장/현금으로 지출했는지를 기록한다.
- **공동/개인 구분**은 `is_shared` 필드로 명시적으로 구분한다.
  - `is_shared = true` → 공동 수단(공동통장, 공동카드)
  - `is_shared = false` → 개인 수단
- **결제 수단은 지출 전용**이다. 수입 거래에는 결제 수단을 지정할 수 없다.

---

## 2. 사용 시나리오

| 상황                             | 결제 수단       | 결제자(paid_by)  | 비고                        |
| -------------------------------- | --------------- | ---------------- | --------------------------- |
| 같이 밥, 남편 카드 결제          | 남편 신한카드   | 남편             |                             |
| 같이 밥, 남편 카드를 아내가 결제 | 남편 신한카드   | 아내             | 카드 소유자 ≠ 결제자        |
| 공동 통장 자동이체 (관리비)      | 공동통장        | NULL             | 공동 수단, 결제자 무의미    |
| 아내 혼자 점심, 본인 카드        | 아내 카카오카드 | 아내 (또는 생략) |                             |
| 현금 지출                        | 현금            | 남편             |                             |
| 결제 수단 모르겠음               | NULL            | 남편             | 선택 사항이므로 미지정 가능 |

---

## 3. 데이터 모델

### 3.1. ER 다이어그램 (변경 후)

```text
profiles ─────┬──────────────────────────────────────┐
              │                                      │
              v (FK: owner_id)                       v (FK: paid_by)
     payment_methods ◄───────────────────── transactions
              │                                      │
              └──── FK: ledger_id ──► ledgers ◄──────┘
```

### 3.2. payment_methods 테이블

| 컬럼       | 타입                 | Nullable | 기본값              | 비고                                                       |
| ---------- | -------------------- | -------- | ------------------- | ---------------------------------------------------------- |
| id         | uuid                 | NO       | `gen_random_uuid()` | PK                                                         |
| ledger_id  | uuid                 | NO       | —                   | FK → ledgers(id) ON DELETE CASCADE                         |
| owner_id   | uuid                 | YES      | —                   | FK → profiles(id) ON DELETE SET NULL. 생성/소유자 참조     |
| is_shared  | boolean              | NO       | `false`             | 공동 수단 여부 (owner_id NULL과 독립적으로 판단)           |
| name       | text                 | NO       | —                   | "신한카드", "공동통장", "현금" 등                          |
| icon       | text                 | YES      | `'credit-card'`     |                                                            |
| sort_order | integer              | YES      | `0`                 |                                                            |
| created_at | timestamptz          | YES      | `now()`             |                                                            |
| updated_at | timestamptz          | YES      | `now()`             |                                                            |
| deleted_at | timestamptz          | YES      | —                   | soft delete                                                |

> **설계 결정: `is_shared` vs `owner_id = NULL`**
>
> `owner_id`의 NULL에 "공동 수단"이라는 비즈니스 의미를 부여하면, 소유자 탈퇴 시 `ON DELETE SET NULL`로
> 개인 수단이 의도치 않게 공동 수단으로 전환되는 버그가 발생한다. `is_shared` 컬럼으로 공동 여부를
> 명시적으로 관리하면, 소유자 탈퇴 시에도 "주인 없는 개인 수단"으로 남아 별도 처리(삭제 또는 이전)가 가능하다.

> **설계 결정: `is_active` 제거**
>
> 기존 `categories` 테이블에는 `is_active`가 "목록에서 숨기기" 기능으로 사용되지만,
> 결제 수단에는 "일시 비활성화" 요구사항이 없다. `deleted_at`만으로 soft delete를 처리하여
> 상태 조합의 모호성을 제거한다.

**제약 조건:**

- `UNIQUE (ledger_id, owner_id, name) WHERE deleted_at IS NULL` — 동일 소유자의 활성 결제 수단 이름 중복 방지
- `UNIQUE (ledger_id, name) WHERE deleted_at IS NULL AND owner_id IS NULL` — 공동 수단(owner_id = NULL)의 이름 중복 방지. PostgreSQL UNIQUE에서 NULL은 서로 다른 값으로 취급되므로, 공동 수단용 별도 partial unique index가 필요하다.

### 3.3. transactions 테이블 변경

| 변경 사항 | 내용                                                                                      |
| --------- | ----------------------------------------------------------------------------------------- |
| 컬럼 추가 | `payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL`                |
| 제약 추가 | `CHECK (type = 'expense' OR payment_method_id IS NULL)` — 수입 거래에 결제 수단 지정 방지 |

### 3.4. paid_by 의미 유지

```text
기존 의미를 그대로 유지한다:
- paid_by 값이 있으면 → 그 사람이 결제자
- paid_by가 NULL이면 → 작성자(created_by)와 동일

결제 수단(payment_method_id)은 "어떤 수단으로 결제했는가"를 독립적으로 표현하며,
paid_by와 상호 유추하지 않는다. 두 필드는 독립된 두 축이다.
```

---

## 4. SQL 마이그레이션

### 4.1. 테이블 생성

```sql
-- payment_methods 테이블
CREATE TABLE payment_methods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ledger_id uuid NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_shared boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  icon text DEFAULT 'credit-card',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- 동일 소유자의 활성 결제 수단 이름 중복 방지
CREATE UNIQUE INDEX unique_active_payment_method_name
  ON payment_methods (ledger_id, owner_id, name)
  WHERE deleted_at IS NULL;

-- 공동 수단(owner_id = NULL)의 이름 중복 방지
-- PostgreSQL UNIQUE에서 NULL은 서로 다른 값으로 취급되므로 별도 partial index 필요
CREATE UNIQUE INDEX unique_active_shared_payment_method_name
  ON payment_methods (ledger_id, name)
  WHERE deleted_at IS NULL AND owner_id IS NULL;
```

### 4.2. 인덱스

```sql
CREATE INDEX idx_payment_methods_ledger
  ON payment_methods (ledger_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_transactions_payment_method
  ON transactions (payment_method_id)
  WHERE deleted_at IS NULL;
```

### 4.3. transactions 변경

```sql
ALTER TABLE transactions
  ADD COLUMN payment_method_id uuid
    REFERENCES payment_methods(id) ON DELETE SET NULL;

ALTER TABLE transactions
  ADD CONSTRAINT check_payment_method_expense_only
    CHECK (type = 'expense' OR payment_method_id IS NULL);
```

### 4.4. Cross-Ledger 참조 방지 트리거

```sql
-- 거래의 payment_method_id가 같은 가계부에 속하는지 검증
-- INSERT일 때 또는 payment_method_id가 실제 변경된 경우에만 검증한다.
-- UPDATE 시 금액/제목만 수정해도 soft-delete된 결제 수단 참조로 예외가 발생하는 버그를 방지.
-- (참고: 기존 check_transaction_category_type 트리거는 category_details 뷰를 사용하여 이 문제가 없음)
CREATE OR REPLACE FUNCTION check_payment_method_ledger_match()
RETURNS trigger AS $$
BEGIN
  IF NEW.payment_method_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.payment_method_id IS DISTINCT FROM NEW.payment_method_id)
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM payment_methods
      WHERE id = NEW.payment_method_id
        AND ledger_id = NEW.ledger_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION '결제 수단이 해당 가계부에 속하지 않습니다.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_transaction_payment_method_match
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_payment_method_ledger_match();

-- ledger_id 변경 방지 트리거
-- RLS의 USING/WITH CHECK만으로는 다중 가계부 멤버가 ledger_id를 변경하는 것을 차단할 수 없다.
-- (USING은 변경 전, WITH CHECK은 변경 후 값을 검증하므로, 양쪽 가계부 멤버면 둘 다 통과)
CREATE OR REPLACE FUNCTION prevent_ledger_id_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.ledger_id IS DISTINCT FROM NEW.ledger_id THEN
    RAISE EXCEPTION 'ledger_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_payment_method_ledger_change
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_id_change();

-- 기존 categories 테이블에도 동일 취약점이 있으므로 함께 적용
CREATE TRIGGER prevent_category_ledger_change
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_id_change();
```

### 4.5. RLS 정책

```sql
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- SELECT: 가계부 멤버만 조회 (soft-deleted 포함 — active_transactions 뷰에서 과거 거래의 결제 수단 정보 보존)
-- 결제 수단 목록 UI에서는 앱 레이어에서 deleted_at IS NULL 필터 적용
CREATE POLICY "payment_methods_select_policy"
  ON payment_methods FOR SELECT
  USING (
    ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- INSERT: 가계부 멤버면 누구 소유든 등록 가능
CREATE POLICY "payment_methods_insert_policy"
  ON payment_methods FOR INSERT
  WITH CHECK (
    ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
        AND deleted_at IS NULL
    )
  );

-- UPDATE: owner/admin/member만 수정, soft delete된 행 접근 차단
CREATE POLICY "payment_methods_update_policy"
  ON payment_methods FOR UPDATE
  USING (
    deleted_at IS NULL
    AND ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
        AND deleted_at IS NULL
    )
  );
```

> **설계 결정: DELETE 정책 제거**
>
> soft delete 패턴을 사용하므로 실제 DELETE 쿼리는 발생하지 않는다.
> `cleanup_old_deleted_data()`의 hard delete는 SECURITY DEFINER로 RLS를 우회한다.
> 불필요한 DELETE 정책을 제거하여 혼란을 방지한다.

### 4.6. Soft Delete 함수

```sql
CREATE OR REPLACE FUNCTION soft_delete_payment_method(target_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM payment_methods pm
    JOIN ledger_members lm ON pm.ledger_id = lm.ledger_id
    WHERE pm.id = target_id
      AND pm.deleted_at IS NULL
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin', 'member')
      AND lm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied or payment method not found';
  END IF;

  UPDATE payment_methods
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = target_id
    AND deleted_at IS NULL;

  RETURN true;
END;
$$;

-- 권한 설정
REVOKE EXECUTE ON FUNCTION soft_delete_payment_method(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION soft_delete_payment_method(uuid) TO authenticated;

COMMENT ON FUNCTION soft_delete_payment_method(uuid)
  IS '결제 수단을 소프트 삭제합니다. 해당 결제 수단을 참조하는 기존 거래는 영향받지 않습니다.';
```

### 4.7. 기존 함수 업데이트

```sql
-- cleanup_old_deleted_data에 payment_methods 추가
-- (기존 함수 내 마지막 DELETE 문 뒤에 추가)
DELETE FROM payment_methods
WHERE deleted_at IS NOT NULL
  AND deleted_at < now() - INTERVAL '30 days';

-- force_clean_user에 payment_methods.owner_id NULL 처리 추가
-- (기존 paid_by NULL 처리 직후에 추가)
UPDATE payment_methods
SET owner_id = NULL
WHERE owner_id = target_user_id;

-- process_account_deletions()와 process_account_deletions_clean()은 profiles를 직접 DELETE하며,
-- owner_id FK가 ON DELETE SET NULL로 설정되어 있으므로 자동 처리된다. 별도 수정이 불필요하다.
-- force_clean_user 내의 위 UPDATE 문은 FK 동작 전에 방어적으로 실행되는 것이다.
```

---

## 5. active_transactions 뷰 변경

```sql
-- 기존 마이그레이션(20260302000001, 20250901000001) 패턴에 따라 DROP+CREATE 사용.
-- 컬럼 추가뿐 아니라 JOIN 변경이 포함되므로, DROP 후 재생성이 안전하다.
DROP VIEW IF EXISTS active_transactions CASCADE;

CREATE VIEW active_transactions AS
SELECT
  t.id,
  t.ledger_id,
  t.category_id,
  t.created_by,
  t.amount,
  t.type,
  t.title,
  t.description,
  t.transaction_date,
  t.created_at,
  t.updated_at,
  t.deleted_at,
  t.paid_by,
  cd.name     AS category_name,
  cd.color    AS category_color,
  cd.icon     AS category_icon,
  cd.source_type AS category_source,
  l.name      AS ledger_name,
  p.full_name AS created_by_name,
  p2.full_name AS paid_by_name,
  t.payment_method_id,
  pm.name     AS payment_method_name,
  pm.icon     AS payment_method_icon,
  pm.is_shared AS payment_method_is_shared
FROM transactions t
  JOIN category_details cd ON t.category_id = cd.id
  JOIN ledgers l ON t.ledger_id = l.id
  LEFT JOIN profiles p ON t.created_by = p.id
  LEFT JOIN profiles p2 ON t.paid_by = p2.id
  LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
WHERE t.deleted_at IS NULL
  AND l.deleted_at IS NULL;

-- DROP 시 security_invoker 설정이 소멸하므로 재적용 (20260303000001 패턴)
ALTER VIEW active_transactions SET (security_invoker = on);

COMMENT ON VIEW active_transactions
  IS '활성 거래 목록 (결제 수단 정보 포함)';
```

> **설계 결정: 불필요한 JOIN 제거**
>
> `payment_method_owner_name`과 `payment_method_type`을 뷰에서 제외하여 JOIN을 줄인다.
> 소유자 이름이 필요한 거래 상세 화면에서는 별도 쿼리로 조회한다.

> **설계 결정: soft-deleted 결제 수단 정보 보존**
>
> `security_invoker = on`이므로 뷰 쿼리 시 호출자의 RLS가 적용된다.
> SELECT RLS에서 `deleted_at IS NULL` 조건을 제거하여, 삭제된 결제 수단의 이름/아이콘이
> 과거 거래에서 계속 표시되도록 한다. 이는 profiles의 동작(탈퇴 사용자 이름 유지)과 일관적이다.
> 결제 수단 목록 UI에서는 앱 레이어에서 `deleted_at IS NULL` 필터를 적용한다.

---

## 6. 클린 아키텍처 레이어 변경

### 6.1. domain 레이어

```text
packages/core/src/domain/payment-method/
  ├── types.ts       # PaymentMethodEntity 타입
  └── rules.ts       # 비즈니스 규칙 (수입에 결제 수단 불가 등)
```

```typescript
// types.ts
import type { EntityId, DomainDate } from '../shared/types';

export interface PaymentMethodEntity {
  id: EntityId;
  ledgerId: EntityId;
  ownerId: EntityId | null;
  isShared: boolean;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: DomainDate;
  updatedAt: DomainDate;
  isDeleted: boolean;
}

// rules.ts
import type { CategoryType } from '../ledger/types';
import { ValidationError } from '../shared/errors';
import { PAYMENT_METHOD_MAX_NAME_LENGTH } from '../shared/constants';

export const PaymentMethodRules = {
  MAX_NAME_LENGTH: PAYMENT_METHOD_MAX_NAME_LENGTH,

  validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('결제 수단 이름은 필수입니다');
    }
    if (name.length > this.MAX_NAME_LENGTH) {
      throw new ValidationError(
        `결제 수단 이름은 ${this.MAX_NAME_LENGTH}자를 초과할 수 없습니다`
      );
    }
  },

  canAttachPaymentMethod(transactionType: CategoryType): boolean {
    return transactionType === 'expense';
  },

  /**
   * 거래 수정 시 타입이 변경되면 paymentMethodId를 초기화해야 한다.
   * DB CHECK 제약(check_payment_method_expense_only)과의 정합성을 보장하기 위해
   * 애플리케이션 레이어에서도 방어적으로 처리한다.
   */
  sanitizePaymentMethodOnTypeChange(
    newType: CategoryType,
    paymentMethodId: EntityId | null
  ): EntityId | null {
    return this.canAttachPaymentMethod(newType) ? paymentMethodId : null;
  },
};
```

### 6.2. application 레이어

```text
packages/core/src/application/payment-method/
  ├── types.ts                  # CreatePaymentMethodInput, UpdatePaymentMethodInput
  └── PaymentMethodService.ts
```

```typescript
// PaymentMethodService.ts
import type { PaymentMethodEntity } from '../../domain/payment-method/types';
import type { CreatePaymentMethodInput, UpdatePaymentMethodInput } from './types';

export class PaymentMethodService {
  constructor(
    private paymentMethodRepo: PaymentMethodRepository,
    private memberRepo: LedgerMemberRepository,
    private authService: AuthService
  ) {}

  async getByLedger(ledgerId: string): Promise<PaymentMethodEntity[]> { ... }
  async create(input: CreatePaymentMethodInput): Promise<string> { ... }
  async update(id: string, input: UpdatePaymentMethodInput): Promise<void> { ... }
  async softDelete(id: string): Promise<boolean> { ... }
}
```

### 6.3. infrastructure 레이어

```text
packages/core/src/infrastructure/supabase/
  ├── repositories/
  │   └── SupabasePaymentMethodRepository.ts
  └── mappers/
      └── paymentMethodMapper.ts
```

### 6.4. transaction 도메인 변경

```typescript
// domain/transaction/types.ts — TransactionEntity에 추가
export interface TransactionEntity {
  // ... 기존 필드
  paymentMethodId?: EntityId; // 추가 (기존 paidBy?: EntityId 패턴)
}

// shared/types.ts — TransactionWithDetails에 결제 수단 정보 추가 (active_transactions 뷰와 매핑)
export interface TransactionWithDetails {
  // ... 기존 필드 (category_name, category_color, etc.)
  payment_method_name: string | null;    // pm.name
  payment_method_icon: string | null;    // pm.icon
  payment_method_is_shared: boolean | null; // pm.is_shared
}
```

> **구현 순서**: `TransactionWithDetails` 타입 업데이트는 2단계(core 패키지)에서 진행한다. 매퍼에서 `active_transactions` 뷰의 `payment_method_name`, `payment_method_icon`, `payment_method_is_shared` 컬럼을 매핑한다.

### 6.5. 팩토리 함수 추가

```typescript
// createPaymentMethodService(supabase) 추가
// ServiceProvider에 paymentMethodService 등록
```

---

## 7. UI 변경

### 7.1. 가계부 설정 > 결제 수단 관리

- 결제 수단 목록 (이름, 타입 아이콘, 소유자)
- 추가/수정/삭제 (공동 여부 토글 포함)
- 정렬 순서 변경
- 추가/수정 모달은 `EditCategoryModal` 패턴 재사용
- 아이콘 선택 UI 필수 (text 직접 입력 불가) — `CategoryItem` 아이콘 그리드 재사용
- 삭제 시 구체적 안내 필요: "이 수단이 사용된 거래 N건에서 결제 수단 정보가 사라집니다"
- 결제 수단 목록을 "공동 / 내 수단 / 파트너 수단"으로 그룹핑하여 표시
- 바텀시트에서 항목 롱프레스 → 컨텍스트 메뉴(수정/삭제) 제공. 공동 뱃지는 섹션 그룹핑으로 대체하여 개별 항목에서 제거

### 7.2. 거래 입력 화면

- 결제 수단 선택 UI 추가 (지출 타입일 때만 표시)
- 결제자(paid_by) 기본값은 거래 생성자(현재 유저). 결제 수단 선택과 paid_by는 독립적
- 선택 사항: 미지정 가능
- 빈 결제 수단 목록에서 "새 수단 추가" 인라인 버튼 제공
- 선택된 결제 수단의 실제 아이콘을 동적으로 표시 (`getIoniconName` 사용)
- 공동 결제 수단 선택 시 "공동" 뱃지 표시 (지출자의 "나" 뱃지 패턴 재사용)

### 7.3. 거래 상세/목록

- 거래 목록에서는 결제 수단 뱃지 미표시 (정보 과부하 방지)
- 거래 상세 화면에서만 결제 수단 뱃지 표시 (아이콘 + 이름)
- 공동 수단일 경우 시각적 구분

### 7.4. 신규 사용자 온보딩

- 기본 결제 수단 없음(ADR-9) 보완: 첫 거래 이후 "결제 수단을 등록하면 카드별 지출을 추적할 수 있어요" 가이드 토스트

### 7.5. viewer 역할

- viewer는 결제 수단 조회만 가능
- 편집/삭제 버튼은 완전히 숨김 (disable이 아닌 hide)

### 7.6. 코드 재사용 기회

| 기존 컴포넌트 | 재사용 대상 |
| --- | --- |
| `PaidByBottomSheet` | 결제 수단 선택 바텀시트 패턴 |
| `EditCategoryModal` | 결제 수단 추가/수정 모달 |
| `CategoryItem` | 아이콘 선택 그리드 |
| `DetailSection + DetailRow` | 관리 화면 레이아웃 |

---

## 8. 데이터 마이그레이션

기존 거래는 `payment_method_id = NULL`로 유지한다. 결제 수단 컬럼이 nullable이므로 마이그레이션 비용이 없고, 사용자가 새 거래부터 결제 수단을 선택하면 자연스럽게 데이터가 쌓인다.

`paid_by`의 기존 데이터와 의미("NULL이면 작성자와 동일")도 그대로 유지한다. 데이터 변환 불필요.

---

## 9. 구현 순서

### 1단계: DB + 기본 CRUD ✅

- [x] `payment_methods` 테이블 마이그레이션 생성
- [x] `transactions.payment_method_id` 컬럼 추가
- [x] `check_payment_method_expense_only` 제약 조건 추가
- [x] Cross-ledger 참조 방지 트리거 (`check_payment_method_ledger_match`)
- [x] ledger_id 변경 방지 트리거 (`prevent_ledger_id_change` — payment_methods + categories)
- [x] RLS 정책 (SELECT, INSERT, UPDATE — DELETE 제외)
- [x] 인덱스 생성
- [x] `soft_delete_payment_method` 함수 + GRANT 설정
- [x] `active_transactions` 뷰 갱신
- [x] `cleanup_old_deleted_data`에 `payment_methods` 추가
- [x] `force_clean_user`에 `payment_methods.owner_id` NULL 처리 추가

> **NOTE: 기존 `categories` RLS — 이미 적용됨**
>
> `schema.sql` 확인 결과, `categories` INSERT/UPDATE RLS에 이미 `role IN ('owner', 'admin', 'member')`로
> viewer 역할이 제외되어 있다. 결제 수단 RLS와 일관성이 확보되어 있으므로 별도 작업이 불필요하다.

### 2단계: core 패키지 + 서비스 연결 ✅

**신규 파일:**

- [x] `domain/payment-method/types.ts` — `PaymentMethodEntity`, `PaymentMethodRepository`, Command 타입
- [x] `domain/payment-method/rules.ts` — `PaymentMethodRules` (validateName, canAttachPaymentMethod, sanitize, create, update)
- [x] `application/payment-method/types.ts` — `CreatePaymentMethodInput`, `UpdatePaymentMethodInput`
- [x] `application/payment-method/PaymentMethodService.ts` — getByLedger, create, update, softDelete + 권한 체크
- [x] `infrastructure/supabase/repositories/SupabasePaymentMethodRepository.ts` — `PaymentMethodRepository` 구현
- [x] `infrastructure/supabase/mappers/PaymentMethodMapper.ts` — toDomain, toDb, toDbForCreate

**기존 파일 수정:**

- [x] `domain/transaction/types.ts` — `TransactionEntity`, `Create/UpdateTransactionCommand`에 `paymentMethodId` 추가
- [x] `domain/transaction/rules.ts` — create/update에서 `PaymentMethodRules.sanitizePaymentMethodOnTypeChange` 호출 (순서: type → paidBy → paymentMethodId → sanitize → updatedAt)
- [x] `application/transaction/types.ts` — `CreateTransactionInput`, `UpdateTransactionInput`에 `paymentMethodId` 추가
- [x] `application/transaction/TransactionService.ts` — create/update에 `paymentMethodId` 전달
- [x] `application/permission/PermissionService.ts` — PERMISSIONS에 `createPaymentMethod`, `updatePaymentMethod`, `deletePaymentMethod`, `viewPaymentMethods` 추가
- [x] `infrastructure/supabase/mappers/TransactionMapper.ts` — toDomain/toDb/toDbForCreate에 `paymentMethodId` ↔ `payment_method_id` 매핑
- [x] `shared/types.ts` — `TransactionWithDetails`에 `payment_method_id`, `payment_method_name`, `payment_method_icon`, `payment_method_is_shared` 추가
- [x] `packages/core/src/index.ts` — `createPaymentMethodService` 팩토리 + `PaymentMethodService`, `PaymentMethodEntity`, `PaymentMethodRules` 등 타입 re-export
- [x] `domain/shared/constants.ts` — `PAYMENT_METHOD_MAX_NAME_LENGTH = 20` 추가

**네이티브 앱 서비스 연결:**

- [x] `apps/native/services/core/types.ts` — `CoreServices`에 `paymentMethodService` 추가
- [x] `apps/native/services/core/createServices.ts` — `createPaymentMethodService` 팩토리 호출 추가
- [x] `@repo/types` — `PaymentMethod` 인터페이스 추가, `Transaction`에 `payment_method_id` 추가

### 3단계: UI ✅

**신규 파일:**

- [x] `apps/native/constants/paymentMethods.ts` — 결제 수단 아이콘 상수 (Ionicons 기반)
- [x] `apps/native/hooks/usePaymentMethods.ts` — 데이터 hook + `groupPaymentMethods` 유틸 (공동/내 수단/파트너 그룹핑)
- [x] `apps/native/app/payment-methods.tsx` — 결제 수단 관리 화면 (SectionList, 권한 기반 CRUD)
- [x] `apps/native/components/payment-method/PaymentMethodItem.tsx` — 리스트 아이템 (아이콘 + 이름 + 뱃지)
- [x] `apps/native/components/payment-method/AddPaymentMethodModal.tsx` — 추가 모달 (이름, 아이콘 그리드, 공동 토글)
- [x] `apps/native/components/payment-method/EditPaymentMethodModal.tsx` — 수정 모달 (변경된 필드만 전송)
- [x] `apps/native/components/shared/PaymentMethodBottomSheet.tsx` — 선택 바텀시트 (PaidByBottomSheet 패턴 + ScrollView). 서브 모달은 BaseBottomSheet children 안에 배치 (iOS 모달 중첩 방지)
- [x] `apps/native/components/payment-method/PaymentMethodContextMenu.tsx` — 롱프레스 컨텍스트 메뉴 (수정/삭제)

**기존 파일 수정:**

- [x] `apps/native/app/ledger-settings.tsx` — 가계부 설정에 "결제 수단 관리" 진입점 추가
- [x] `apps/native/app/(tabs)/add.tsx` — 거래 입력에 결제 수단 선택 버튼/state 추가 (지출 전용, 수입 전환 시 초기화). 선택된 수단의 실제 아이콘 동적 표시 + 공동 수단 "공동" 뱃지 표시
- [x] `apps/native/app/transaction-detail.tsx` — 거래 상세에 결제 수단 표시/변경/해제 추가
- [x] `apps/native/hooks/useTransactionDetail.ts` — `paymentMethodId` 낙관적 업데이트 + 롤백 분기 추가
- [x] `packages/core/src/application/transaction/types.ts` — `UpdateTransactionInput.paymentMethodId: string | null` (null=해제)
- [x] `packages/core/src/domain/transaction/types.ts` — `UpdateTransactionCommand.paymentMethodId: EntityId | null`
- [x] `packages/core/src/domain/transaction/rules.ts` — null → undefined 변환 (도메인 엔티티 타입 정합성)

---

## 10. 확장 가능성

현재 설계에서는 다루지 않지만, 향후 필요 시 확장 가능한 영역:

| 기능                         | 확장 방법                                                                |
| ---------------------------- | ------------------------------------------------------------------------ |
| 수입 입금 계좌               | CHECK 제약 제거 한 줄로 해결 가능. 별도 테이블 불필요                    |
| 결제 수단의 사용자 레벨 공유 | `ledger_id`를 nullable로 변경, 개인 수단은 `owner_id`만으로 조회         |
| 카드 한도/결제일 관리        | `payment_methods`에 `credit_limit`, `billing_day` 컬럼 추가              |
| 더치페이/정산                | `transaction_shares` 분배 테이블 도입                                    |
| 결제 수단 스냅샷 (정보 보존) | 거래에 `payment_method_name` 등 비정규화 컬럼 추가 (hard delete 대비)    |
| color 컬럼                   | 초기 설계에서 제거. MVP에 불필요하며, 필요 시 ALTER TABLE로 추가 가능    |
| 기본 결제 수단 자동 생성     | 초기 설계에서 제거. 사용자마다 결제 수단이 다르므로 직접 추가가 자연스러움 |
| 결제 수단별 통계/리포트      | 월간 결제 수단별 지출 집계, 공동/개인 수단 비교 등. 실제 요구사항 확정 후 구현 |

---

## 부록: 설계 결정 기록 (ADR)

### ADR-1: `is_shared` 명시적 컬럼 도입 (owner_id NULL 의미 오버로딩 제거)

- **결정**: `is_shared boolean NOT NULL DEFAULT false` 컬럼을 추가하여 공동/개인 구분을 명시적으로 관리
- **근거**: `owner_id = NULL`에 "공동 수단"이라는 의미를 부여하면, 소유자 탈퇴 시 `ON DELETE SET NULL`로 개인 수단이 자동으로 공동 수단으로 전환되는 데이터 무결성 버그 발생
- **트레이드오프**: 컬럼 1개 추가 비용 vs 데이터 정합성 보장

### ADR-2: paid_by 의미 유지 (유추 로직 미도입)

- **결정**: `paid_by`의 기존 의미("NULL이면 작성자와 동일")를 변경하지 않음
- **근거**: 3단계 유추 로직(`paid_by → payment_method.owner_id → 미지정`)은 (1) 기존 데이터의 의미를 소급 변경하고, (2) payment_method 삭제 시 유추 체인이 끊겨 정보 소실되며, (3) UI 레이어에 복잡한 폴백 로직을 요구함
- **대안**: 결제자(paid_by) 기본값은 거래 생성자(현재 유저)로 설정. 결제 수단 선택과 paid_by는 독립적

### ADR-3: type 컬럼 및 ENUM 미사용

- **결정**: `payment_method_type` ENUM과 `type` 컬럼을 사용하지 않음
- **근거**: 결제 수단의 이름("신한카드", "국민은행")과 아이콘이 이미 종류를 표현하므로, `type`은 정보를 중복 저장할 뿐 실질적 비즈니스 로직에 활용되지 않음. 향후 타입별 집계가 필요하면 컬럼 1개 ALTER로 추가 가능
- **트레이드오프**: ENUM 관리 비용 제거 vs 타입별 자동 분류 불가 (이름 기반으로 충분)

### ADR-4: is_active 제거

- **결정**: `is_active` 컬럼을 사용하지 않고, `deleted_at`만으로 soft delete 처리
- **근거**: `is_active + deleted_at` 조합 시 4가지 상태 중 2가지(`is_active=false, deleted_at=NULL` / `is_active=true, deleted_at≠NULL`)가 정의되지 않거나 모순. 결제 수단에 "일시 비활성화" 요구사항이 없으므로 불필요한 복잡성

### ADR-5: DELETE RLS 정책 미생성

- **결정**: `FOR DELETE` RLS 정책을 생성하지 않음
- **근거**: soft delete 전용이므로 실제 DELETE 쿼리는 발생하지 않음. hard delete는 `cleanup_old_deleted_data()` (SECURITY DEFINER)가 RLS를 우회하여 처리. DELETE 정책이 있으면 owner가 soft delete 대신 hard delete를 실행하여 `ON DELETE SET NULL`로 과거 거래 정보가 즉시 소실되는 위험이 있음

### ADR-6: color 컬럼 제거

- **결정**: `payment_methods` 테이블에 `color` 컬럼을 포함하지 않음
- **근거**: MVP에서 결제 수단별 색상 커스터마이징 요구사항이 없고, `icon`만으로 시각적 구분이 충분함. 필요 시 ALTER TABLE 한 줄로 추가 가능

### ADR-7: ledger_id 변경 방지 트리거 도입

- **결정**: `prevent_ledger_id_change` 트리거를 payment_methods와 categories에 도입
- **근거**: RLS의 USING(변경 전 값 검증)/WITH CHECK(변경 후 값 검증) 구조상, 다중 가계부 멤버가 `ledger_id`를 다른 가계부로 변경하는 UPDATE가 통과할 수 있음. Supabase는 PostgREST를 통해 클라이언트가 직접 SQL을 실행할 수 있으므로, 앱 코드의 부재가 보안 경계가 될 수 없음
- **범위**: 범용 트리거 함수 하나로 payment_methods, categories 양쪽에 적용

### ADR-8: 공동 수단 이름 중복 허용

- **결정**: `is_shared = true`인 공동 수단의 가계부 내 이름 유일성을 강제하지 않음
- **근거**: 공동 수단은 `owner_id`가 다르면 별개의 수단으로 취급한다. 남편이 만든 "공동통장"과 아내가 만든 "공동통장"이 공존할 수 있으나, 실제 사용에서는 앱 UI에서 중복 이름 경고를 표시하여 UX 레벨에서 방지한다. DB 레벨 제약은 과도한 복잡성을 추가하므로 도입하지 않는다.

### ADR-9: 기본 결제 수단 자동 생성 제거

- **결정**: `initialize_default_payment_methods` 함수를 도입하지 않음
- **근거**: 카테고리와 달리 결제 수단은 사용자마다 보유한 카드/계좌가 다르므로, 범용적인 기본값("현금", "카드", "이체")이 실질적 가치를 제공하지 않음. 사용자가 직접 추가하는 것이 더 자연스러운 UX
