# 결제 수단(Payment Methods) 아키텍처

## 1. 배경 및 목적

### 해결하려는 문제

기존 `paid_by`(지출자) 필드 하나로는 부부/가족 가계부에서 흔히 발생하는 상황을 정확히 표현할 수 없다.

- "같이 밥 먹고 남편 카드로 결제" — 공동 지출인데 지출자를 누구로?
- "남편 카드를 아내가 들고 가서 결제" — 카드 소유자 ≠ 실제 결제자
- "이번 달 카드값 얼마지?" — 결제 수단별 통계 불가

### 설계 원칙

- **paid_by**는 "누가 결제했는가"(실제 카드를 긁은 사람)로 의미를 좁힌다.
- **결제 수단**을 별도 엔티티로 분리하여, 어떤 카드/통장/현금으로 지출했는지를 기록한다.
- **공동/개인 구분**은 별도 필드 없이 결제 수단의 `owner_id`로 자동 유추한다.
  - `owner_id = NULL` → 공동 수단(공동통장, 공동카드)
  - `owner_id = 특정 사용자` → 개인 수단
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

| 컬럼       | 타입        | Nullable | 기본값              | 비고                                                     |
| ---------- | ----------- | -------- | ------------------- | -------------------------------------------------------- |
| id         | uuid        | NO       | `gen_random_uuid()` | PK                                                       |
| ledger_id  | uuid        | NO       | —                   | FK → ledgers(id) ON DELETE CASCADE                       |
| owner_id   | uuid        | YES      | —                   | FK → profiles(id) ON DELETE SET NULL. NULL이면 공동 수단 |
| name       | text        | NO       | —                   | "신한카드", "공동통장", "현금" 등                        |
| type       | text        | NO       | `'card'`            | `card` / `bank` / `cash` / `other`                       |
| icon       | text        | YES      | `'credit-card'`     |                                                          |
| color      | text        | YES      | `'#6B7280'`         |                                                          |
| is_active  | boolean     | YES      | `true`              |                                                          |
| sort_order | integer     | YES      | `0`                 |                                                          |
| created_at | timestamptz | YES      | `now()`             |                                                          |
| updated_at | timestamptz | YES      | `now()`             |                                                          |
| deleted_at | timestamptz | YES      | —                   | soft delete                                              |

**제약 조건:**

- `UNIQUE (ledger_id, name) WHERE deleted_at IS NULL` — 활성 결제 수단 이름 중복 방지
- `CHECK (type IN ('card', 'bank', 'cash', 'other'))`

### 3.3. transactions 테이블 변경

| 변경 사항 | 내용                                                                                      |
| --------- | ----------------------------------------------------------------------------------------- |
| 컬럼 추가 | `payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL`                |
| 제약 추가 | `CHECK (type = 'expense' OR payment_method_id IS NULL)` — 수입 거래에 결제 수단 지정 방지 |

### 3.4. paid_by 의미 재정의

```text
기존: "실제 지출자 이름 (NULL이면 작성자와 동일)"
변경: "실제 결제한 사람 (NULL이면 미지정)"

해석 우선순위:
1. paid_by 값이 있으면 → 그 사람이 결제자
2. paid_by가 NULL이고 payment_method가 있으면 → 결제 수단 소유자로 유추
3. 둘 다 NULL이면 → 미지정
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
  name text NOT NULL,
  type text NOT NULL DEFAULT 'card'
    CHECK (type IN ('card', 'bank', 'cash', 'other')),
  icon text DEFAULT 'credit-card',
  color text DEFAULT '#6B7280',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- 활성 결제 수단 이름 중복 방지
CREATE UNIQUE INDEX unique_active_payment_method_name
  ON payment_methods (ledger_id, name)
  WHERE deleted_at IS NULL;
```

### 4.2. 인덱스

```sql
CREATE INDEX idx_payment_methods_ledger_active
  ON payment_methods (ledger_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_payment_methods_owner
  ON payment_methods (owner_id)
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

-- paid_by 코멘트 수정
COMMENT ON COLUMN transactions.paid_by
  IS '실제 결제한 사람. NULL이면 미지정 (결제 수단의 소유자로 유추 가능)';
```

### 4.4. RLS 정책

```sql
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- SELECT: 가계부 멤버만 조회 (soft delete 필터)
CREATE POLICY "payment_methods_select_policy"
  ON payment_methods FOR SELECT
  USING (
    deleted_at IS NULL
    AND ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- INSERT: owner/admin/member만 추가
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

-- UPDATE: owner/admin/member만 수정
CREATE POLICY "payment_methods_update_policy"
  ON payment_methods FOR UPDATE
  USING (
    ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
        AND deleted_at IS NULL
    )
  );

-- DELETE: owner만 삭제
CREATE POLICY "payment_methods_delete_policy"
  ON payment_methods FOR DELETE
  USING (
    ledger_id IN (
      SELECT ledger_id FROM ledger_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND deleted_at IS NULL
    )
  );
```

### 4.5. Soft Delete 함수

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
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin', 'member')
      AND lm.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied to delete this payment method';
  END IF;

  UPDATE payment_methods
  SET is_active = false,
      deleted_at = now(),
      updated_at = now()
  WHERE id = target_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION soft_delete_payment_method(uuid)
  IS '결제 수단을 소프트 삭제합니다. 해당 결제 수단을 참조하는 기존 거래는 영향받지 않습니다 (ON DELETE SET NULL).';
```

### 4.6. 기본 결제 수단 초기화

```sql
CREATE OR REPLACE FUNCTION initialize_default_payment_methods(
  target_ledger_id uuid,
  target_user_id uuid
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO payment_methods (ledger_id, owner_id, name, type, icon, sort_order)
  VALUES
    (target_ledger_id, target_user_id, '현금', 'cash', 'cash', 1),
    (target_ledger_id, target_user_id, '카드', 'card', 'credit-card', 2),
    (target_ledger_id, target_user_id, '이체', 'bank', 'building', 3)
  ON CONFLICT DO NOTHING;
END;
$$;
```

> **참고**: `setup_new_user` 함수 내에서 `activate_default_categories` 호출 직후에
> `PERFORM initialize_default_payment_methods(new_ledger_id, user_uuid);`를 추가한다.

---

## 5. active_transactions 뷰 변경

```sql
CREATE OR REPLACE VIEW active_transactions AS
SELECT
  t.id,
  t.ledger_id,
  t.category_id,
  t.created_by,
  t.paid_by,
  t.payment_method_id,
  t.amount,
  t.type,
  t.title,
  t.description,
  t.transaction_date,
  t.created_at,
  t.updated_at,
  t.deleted_at,
  cd.name     AS category_name,
  cd.color    AS category_color,
  cd.icon     AS category_icon,
  cd.source_type AS category_source,
  l.name      AS ledger_name,
  p.full_name AS created_by_name,
  p2.full_name AS paid_by_name,
  pm.name     AS payment_method_name,
  pm.type     AS payment_method_type,
  pm.icon     AS payment_method_icon,
  pm.color    AS payment_method_color,
  pm_owner.full_name AS payment_method_owner_name
FROM transactions t
  JOIN category_details cd ON t.category_id = cd.id
  JOIN ledgers l ON t.ledger_id = l.id
  LEFT JOIN profiles p ON t.created_by = p.id
  LEFT JOIN profiles p2 ON t.paid_by = p2.id
  LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
  LEFT JOIN profiles pm_owner ON pm.owner_id = pm_owner.id
WHERE t.deleted_at IS NULL
  AND l.deleted_at IS NULL;

COMMENT ON VIEW active_transactions
  IS '활성 거래 목록 (결제 수단 정보 포함)';
```

---

## 6. 통계 쿼리

### 6.1. 결제 수단별 월간 지출

```sql
SELECT
  pm.name   AS payment_method_name,
  pm.type   AS payment_method_type,
  p.full_name AS owner_name,
  SUM(t.amount) AS total_amount,
  COUNT(*)  AS transaction_count
FROM transactions t
  JOIN payment_methods pm ON t.payment_method_id = pm.id
  LEFT JOIN profiles p ON pm.owner_id = p.id
WHERE t.ledger_id = $1
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND EXTRACT(year FROM t.transaction_date) = $2
  AND EXTRACT(month FROM t.transaction_date) = $3
GROUP BY pm.id, pm.name, pm.type, p.full_name
ORDER BY total_amount DESC;
```

### 6.2. 공동 수단 vs 개인 수단 비교

```sql
SELECT
  CASE WHEN pm.owner_id IS NULL THEN '공동' ELSE '개인' END AS scope,
  SUM(t.amount) AS total_amount,
  COUNT(*) AS transaction_count
FROM transactions t
  JOIN payment_methods pm ON t.payment_method_id = pm.id
WHERE t.ledger_id = $1
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND EXTRACT(year FROM t.transaction_date) = $2
  AND EXTRACT(month FROM t.transaction_date) = $3
GROUP BY (pm.owner_id IS NULL);
```

---

## 7. 클린 아키텍처 레이어 변경

### 7.1. domain 레이어

```text
packages/core/src/domain/payment-method/
  ├── types.ts       # PaymentMethod, PaymentMethodType 타입
  └── rules.ts       # 비즈니스 규칙 (수입에 결제 수단 불가 등)
```

```typescript
// types.ts
export type PaymentMethodType = 'card' | 'bank' | 'cash' | 'other';

export interface PaymentMethod {
  id: string;
  ledgerId: string;
  ownerId: string | null; // null이면 공동
  name: string;
  type: PaymentMethodType;
  icon: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

// rules.ts
export function isSharedPaymentMethod(method: PaymentMethod): boolean {
  return method.ownerId === null;
}

export function canAttachPaymentMethod(
  transactionType: 'income' | 'expense'
): boolean {
  return transactionType === 'expense';
}
```

### 7.2. application 레이어

```text
packages/core/src/application/payment-method/
  └── PaymentMethodService.ts
```

```typescript
// PaymentMethodService.ts
export interface PaymentMethodService {
  getByLedger(ledgerId: string): Promise<PaymentMethod[]>;
  create(params: CreatePaymentMethodParams): Promise<PaymentMethod>;
  update(id: string, params: UpdatePaymentMethodParams): Promise<PaymentMethod>;
  softDelete(id: string): Promise<boolean>;
}
```

### 7.3. infrastructure 레이어

```text
packages/core/src/infrastructure/supabase/
  ├── repositories/
  │   └── SupabasePaymentMethodRepository.ts
  └── mappers/
      └── paymentMethodMapper.ts
```

### 7.4. transaction 도메인 변경

```typescript
// domain/transaction/types.ts에 추가
export interface Transaction {
  // ... 기존 필드
  paymentMethodId: string | null; // 추가
}
```

### 7.5. 팩토리 함수 추가

```typescript
// createPaymentMethodService(supabase) 추가
// ServiceProvider에 paymentMethodService 등록
```

---

## 8. UI 변경

### 8.1. 가계부 설정 > 결제 수단 관리

- 결제 수단 목록 (이름, 타입 아이콘, 소유자)
- 추가/수정/삭제 (소유자 선택 시 "공동" 옵션 포함)
- 정렬 순서 변경

### 8.2. 거래 입력 화면

- 기존 paid_by 라벨을 **"결제자"**로 변경
- 결제 수단 선택 UI 추가 (지출 타입일 때만 표시)
- 선택 사항: 미지정 가능

### 8.3. 거래 상세/목록

- 결제 수단 뱃지 표시 (아이콘 + 이름)
- 공동 수단일 경우 시각적 구분

---

## 9. 데이터 마이그레이션

기존 거래는 `payment_method_id = NULL`로 유지한다. 결제 수단 컬럼이 nullable이므로 마이그레이션 비용이 없고, 사용자가 새 거래부터 결제 수단을 선택하면 자연스럽게 데이터가 쌓인다.

`paid_by`의 기존 데이터도 그대로 유지한다. 의미만 "지출자"에서 "결제자"로 재정의하며, 실제 데이터 변환은 불필요하다.

---

## 10. 구현 순서

### 1단계: DB + 기본 CRUD

- [ ] `payment_methods` 테이블 마이그레이션 생성
- [ ] `transactions.payment_method_id` 컬럼 추가
- [ ] `check_payment_method_expense_only` 제약 조건 추가
- [ ] RLS 정책, 인덱스, soft delete 함수
- [ ] `active_transactions` 뷰 갱신
- [ ] `setup_new_user`에 `initialize_default_payment_methods` 연결
- [ ] `paid_by` 코멘트 수정

### 2단계: core 패키지

- [ ] `domain/payment-method` 타입 및 규칙
- [ ] `application/payment-method/PaymentMethodService`
- [ ] `infrastructure/supabase` 레포지토리 및 매퍼
- [ ] `createPaymentMethodService` 팩토리 함수
- [ ] `transaction` 도메인 타입에 `paymentMethodId` 추가
- [ ] `@repo/types`에 DB 타입 반영

### 3단계: UI

- [ ] 가계부 설정 > 결제 수단 관리 화면
- [ ] 거래 입력 시 결제 수단 선택 UI (지출 전용)
- [ ] `paid_by` 라벨 "결제자"로 변경
- [ ] `ServiceProvider`에 `paymentMethodService` 등록
- [ ] `usePaymentMethods` hook 구현

### 4단계: 통계 (후속)

- [ ] 결제 수단별 지출 리포트
- [ ] 공동/개인 수단별 집계
- [ ] `budget_vs_actual` 뷰에 결제 수단 차원 추가 검토

---

## 11. 확장 가능성

현재 설계에서는 다루지 않지만, 향후 필요 시 확장 가능한 영역:

| 기능                         | 확장 방법                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| 수입 입금 계좌               | 별도 `deposit_account` 개념 도입 (결제 수단과 분리)              |
| 결제 수단의 사용자 레벨 공유 | `ledger_id`를 nullable로 변경, 개인 수단은 `owner_id`만으로 조회 |
| 카드 한도/결제일 관리        | `payment_methods`에 `credit_limit`, `billing_day` 컬럼 추가      |
| 더치페이/정산                | `transaction_shares` 분배 테이블 도입                            |
