# 결제 수단 아키텍처 DB 이슈 검토 결과 (재검증)

> **검토 대상**: `docs/plans/payment-methods-architecture.md` — DB 관련 부분 (섹션 3~5, 4.5~4.7)
> **비교 대상**: `supabase/schema.sql` — 현재 운영 스키마
> **검토 일자**: 2026-03-08
> **검토 방법**: DB Architect, Security Reviewer, Quality Reviewer 3개 전문 에이전트 병렬 검토 → 재검증(실제 이슈 vs 오탐 판별) → Architect 최종 검증

---

## 전체 평가

**DB 설계는 전반적으로 건전하다.** 특히 ADR-1(is_shared 분리), cross-ledger 트리거의 IS DISTINCT FROM 조건, soft delete 함수의 보안 설정이 우수하다. 기존 리뷰의 ERROR 4건 중 2건(E1, E2)은 오탐이었으며, 신규로 Critical 1건, Major 1건을 발견했다.

| 심각도 | 건수 | 설명 |
|--------|------|------|
| Critical (구현 전 수정 필수) | 1건 | UPDATE RLS의 ledger_id 변경 방지 미흡 |
| Major (구현 전 결정 필요) | 2건 | Unique Index와 is_shared 정합성 gap, 뷰 RLS 상호작용으로 인한 정보 소실 |
| Minor (권장 수정) | 3건 | 함수 호출관계 오류, cleanup 순서, 방어적 패턴 누락 |
| Info (참고) | 2건 | COMMENT 보완, 기존 anon REVOKE 부채 |
| 오탐 (기존 리뷰에서 제거) | 2건 | E1(DROP+CREATE), E2(security_invoker) |

---

## 1. 기존 리뷰 오탐 분석

### 오탐 E1: `active_transactions` 뷰 DROP 후 재생성

- **기존 판정**: ERROR — "CREATE OR REPLACE VIEW에서 컬럼 중복 오류 발생"
- **재검증 결과**: **오탐 (False Positive)**
- **근거**: 문서 310~313행에 이미 DROP+CREATE 전략이 명시되어 있음

```
(문서 310~311행)
-- 기존 마이그레이션(20260302000001, 20250901000001) 패턴에 따라 DROP+CREATE 사용.
-- 컬럼 추가뿐 아니라 JOIN 변경이 포함되므로, DROP 후 재생성이 안전하다.

(문서 312행)
DROP VIEW IF EXISTS active_transactions CASCADE;
```

기존 리뷰가 문서를 오독하여 `CREATE OR REPLACE VIEW`를 사용한다고 판단한 것으로 보인다. 실제 문서는 올바르게 DROP+CREATE를 사용한다.

### 오탐 E2: `SECURITY INVOKER` 설정 누락

- **기존 판정**: ERROR — "DROP 후 재생성 시 security_invoker 소멸, 보안 취약점"
- **재검증 결과**: **오탐 (False Positive)**
- **근거**: 문서 349~350행에 이미 재적용이 명시되어 있음

```
(문서 349~350행)
-- DROP 시 security_invoker 설정이 소멸하므로 재적용 (20260303000001 패턴)
ALTER VIEW active_transactions SET (security_invoker = on);
```

문서가 기존 마이그레이션 패턴을 명시적으로 참조하며 재적용을 포함하고 있다.

---

## 2. 실제 이슈 — 재검증 완료

### [Critical] I1. UPDATE RLS에서 ledger_id 변경 방지 미흡

- **위치**: 문서 4.5절 (216~237행), payment_methods_update_policy
- **관련 ADR**: ADR-7 (ledger_id 변경 방지 트리거 제거)

**발견**: UPDATE 정책의 USING/WITH CHECK 조건이 다음과 같다:

```sql
USING (
  deleted_at IS NULL
  AND ledger_id IN (SELECT ledger_id FROM ledger_members WHERE user_id = auth.uid() ...)
)
WITH CHECK (
  deleted_at IS NULL
  AND ledger_id IN (SELECT ledger_id FROM ledger_members WHERE user_id = auth.uid() ...)
)
```

사용자가 가계부 A와 B에 모두 멤버인 경우:
- USING: 변경 **전** 행의 ledger_id가 가계부 A → 통과
- WITH CHECK: 변경 **후** 행의 ledger_id가 가계부 B → 통과
- 결과: `UPDATE payment_methods SET ledger_id = '가계부B' WHERE id = '...'` **성공**

**재검증 — 실제 이슈인가?**

| 관점 | 판단 |
|------|------|
| ADR-7의 논거 ("앱에서 ledger_id UPDATE 경로 없음") | Supabase는 PostgREST를 통해 클라이언트가 직접 SQL을 실행할 수 있으므로, 앱 코드의 부재가 보안 경계가 될 수 없다. **논거 불충분.** |
| 기존 테이블과의 일관성 | `categories_update_policy` (schema.sql:1556)도 동일한 취약점이 존재한다. 기존 부채이나, 새 테이블에서도 반복하는 것은 바람직하지 않다. |
| 실제 공격 시나리오 | 인증된 사용자가 다중 가계부 멤버일 때, 결제 수단을 다른 가계부로 이동시켜 cross-ledger 데이터 무결성을 파괴할 수 있다. cross-ledger 트리거가 transactions에만 적용되므로, 이동된 결제 수단을 참조하는 거래에서 정합성 오류 발생. |

**판정: 실제 이슈 (Critical)**

**수정 제안**:

```sql
-- 방법 1: 트리거로 ledger_id 변경 차단 (권장)
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
```

> **참고**: 기존 categories 테이블에도 동일 취약점이 있으므로, 트리거 함수를 범용으로 만들어 양쪽에 적용하는 것을 권장한다. ADR-7을 재검토하여 이 결정을 반영해야 한다.

---

### [Major] I2. Unique Index와 is_shared 정합성 gap

- **위치**: 문서 3.2절 (79~80행), 4.1절 (122~130행)
- **관련 ADR**: ADR-1 (is_shared와 owner_id 독립 관리)

**발견**: 두 unique index는 모두 `owner_id` 기반이며, `is_shared` 컬럼을 참조하지 않는다.

```sql
-- 인덱스 1: (ledger_id, owner_id, name) WHERE deleted_at IS NULL
-- 인덱스 2: (ledger_id, name) WHERE owner_id IS NULL AND deleted_at IS NULL
```

ADR-1에서 `is_shared`와 `owner_id`를 독립적으로 관리한다고 했으므로, `is_shared = true AND owner_id IS NOT NULL`인 행이 허용된다 (예: 남편이 생성한 공동 수단).

이 경우:
- 남편: `(ledger1, 남편id, "공동통장", is_shared=true)` → 인덱스 1 통과
- 아내: `(ledger1, 아내id, "공동통장", is_shared=true)` → 인덱스 1 통과 (owner_id가 다르므로)
- **동일 이름의 공동 수단이 2개 생성됨**

인덱스 2는 `owner_id IS NULL` 조건이므로 이 케이스를 커버하지 못한다.

**재검증 — 실제 이슈인가?**

| 관점 | 판단 |
|------|------|
| 비즈니스 요건 | 공동 수단은 가계부 전체에서 유일해야 하는가? 같은 이름의 공동통장이 2개 있으면 사용자 혼란. **의도하지 않은 동작일 가능성 높음.** |
| 앱 레이어 방어 | 앱에서 중복 검증을 할 수 있으나, DB 레벨 제약이 없으면 race condition에 취약. |
| 대안: 공동 수단은 항상 owner_id = NULL | 가능하나, 누가 생성했는지 추적할 수 없게 됨. |

**판정: 실제 이슈 (Major) — 구현 전 설계 결정 필요**

**수정 제안** (택 1):

```sql
-- 방안 A: 공동 수단의 가계부 내 이름 유일성 보장 (권장)
CREATE UNIQUE INDEX unique_active_shared_payment_method_name_by_shared
  ON payment_methods (ledger_id, name)
  WHERE deleted_at IS NULL AND is_shared = true;

-- 방안 B: CHECK 제약으로 공동 수단은 owner_id = NULL 강제
ALTER TABLE payment_methods
  ADD CONSTRAINT check_shared_no_owner
    CHECK (is_shared = false OR owner_id IS NULL);
-- → 이 경우 기존 인덱스 2가 공동 수단 이름 유일성을 커버함.
-- → 단, 공동 수단의 생성자 추적이 불가능해짐.

-- 방안 C: 현행 유지 + ADR에 "허용" 명시
-- → 의도적으로 허용한다면, ADR에 근거를 기재
```

---

### [Minor] I3. `process_account_deletions` 호출 관계 사실 오류

- **위치**: 문서 4.7절 (300~302행)

**발견**: 문서에 다음과 같이 서술되어 있다:

> "process_account_deletions()는 내부적으로 force_clean_user()를 호출하며, owner_id FK는 ON DELETE SET NULL로 설정되어 있으므로 별도 처리가 불필요하다."

**재검증**: `schema.sql:432-515`의 `process_account_deletions()` 함수를 확인하면, `force_clean_user()`를 호출하지 않는다. 직접 `DELETE FROM profiles WHERE id = v_result.id`를 실행한다 (478행). `process_account_deletions_clean()`(527행)도 마찬가지로 독자적으로 동작한다.

**판정: 실제 이슈 (Minor) — 서술 오류**

**수정 제안**: 해당 문장을 다음으로 교체:

> "process_account_deletions()와 process_account_deletions_clean()은 profiles를 직접 DELETE하며, payment_methods.owner_id FK가 ON DELETE SET NULL로 설정되어 있으므로 자동 처리된다. 별도 수정이 불필요하다."

---

### [Minor] I4. `cleanup_old_deleted_data` 내 payment_methods DELETE 위치

- **위치**: 문서 4.7절 (288~292행)

**발견**: 문서에 "기존 함수 내 마지막 DELETE 문 뒤에 추가"라고 명시. 현재 삭제 순서는 `transactions → budgets → categories → ledger_members → ledgers`이므로, `ledgers` DELETE 뒤에 배치하게 된다.

**재검증**:

- `payment_methods.ledger_id → ledgers(id) ON DELETE CASCADE`: ledgers hard delete 시 해당 payment_methods는 CASCADE로 자동 삭제됨. 따라서 ledgers 뒤에 payment_methods DELETE를 실행하면, 이미 CASCADE로 삭제된 행은 매칭되지 않을 뿐 오류는 없다.
- `transactions.payment_method_id → payment_methods(id) ON DELETE SET NULL`: payment_methods hard delete 시 활성 거래의 `payment_method_id`가 NULL이 됨. transactions DELETE(1단계)에서 soft-deleted 거래는 이미 제거되었으므로, 활성 거래만 영향받음.

**판정: 실제 이슈 (Minor) — 기능적 오류는 아니나 순서 개선 가능**

FK 의존 순서 관점에서 `transactions` 직후, `budgets` 전에 배치하는 것이 더 명확하다. transactions가 payment_methods를 참조하므로, transactions 삭제 후 payment_methods를 삭제하면 불필요한 SET NULL 동작을 줄일 수 있다.

---

### [Minor] I5. `process_account_deletions_clean`에 payment_methods.owner_id NULL 처리 누락

- **위치**: 문서 4.7절 — 미언급

**발견**: `force_clean_user`에는 `UPDATE payment_methods SET owner_id = NULL` 추가를 명시했으나, `process_account_deletions_clean`에 대해서는 언급이 없다. `process_account_deletions_clean`(schema.sql:572-586)은 `transactions.created_by`, `paid_by`, `budgets.created_by`, `ledgers.created_by`를 명시적으로 NULL 처리하는 방어적 패턴을 사용한다.

**재검증**:

- FK `ON DELETE SET NULL`이 자동 처리하므로 기능적 문제는 아니다.
- 그러나 기존 함수가 4개 컬럼에 대해 방어적 명시 패턴을 쓰면서 payment_methods만 누락하면 일관성이 떨어진다.

**판정: 실제 이슈 (Minor) — 방어적 패턴 일관성**

**수정 제안**: 문서 4.7절에 다음 내용 추가:

> `process_account_deletions_clean`에도 기존 방어적 패턴과 일관되게 `UPDATE payment_methods SET owner_id = NULL WHERE owner_id = v_result.id;`를 추가한다. (기능적으로는 FK ON DELETE SET NULL이 커버하나, 코드 일관성을 위한 방어적 처리)

---

## 3. 참고 사항 (Info)

### [Info] I6. `soft_delete_payment_method` COMMENT 보완 고려

- **위치**: 문서 4.6절 (281~282행)
- **내용**: "해당 결제 수단을 참조하는 기존 거래는 영향받지 않습니다"
- **사실**: soft delete 시점에서는 정확. 30일 후 `cleanup_old_deleted_data`에서 hard delete 시 `ON DELETE SET NULL`로 `payment_method_id`가 NULL이 됨.
- **판정**: 기존 soft_delete 함수들의 COMMENT도 유사 수준이므로 기존 패턴과 일관적. 보완하면 좋으나 필수는 아님.

### [Major] I7. `active_transactions` 뷰의 security_invoker + RLS 상호작용으로 인한 정보 소실

- **위치**: 문서 5절 (345행), 문서 4.5절 (194~202행)

**발견**: `active_transactions` 뷰에서 `LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id`에 `pm.deleted_at IS NULL` 필터가 없다. 표면적으로는 soft-deleted 결제 수단의 정보가 과거 거래에서 보존되는 것처럼 보인다.

**실제 동작**: `security_invoker = on`이므로 뷰 쿼리 시 호출자의 RLS가 적용된다. `payment_methods_select_policy`는 `deleted_at IS NULL` 조건을 포함하므로, **soft-deleted 결제 수단 행이 RLS에 의해 필터링되어 LEFT JOIN 결과가 NULL로 반환된다.**

결과적으로:
- 결제 수단 soft delete 직후부터 `payment_method_name`, `payment_method_icon`, `payment_method_is_shared`가 모두 NULL
- 기존 `profiles` LEFT JOIN은 profiles SELECT RLS에 `deleted_at IS NULL` 조건이 없으므로 탈퇴 사용자 이름이 보존됨
- **비대칭 동작**: 삭제된 결제 수단 정보는 사라지지만, 탈퇴한 사용자 이름은 유지

**재검증 — 실제 이슈인가?**

| 관점 | 판단 |
|------|------|
| 사용자 경험 | 삭제한 카드의 이름이 과거 거래에서 즉시 사라짐. "어떤 카드로 결제했는지" 이력 소실. **부정적.** |
| 기존 패턴과의 일관성 | profiles와 비대칭. 구현자가 "LEFT JOIN이므로 정보 보존"이라 기대하면 오동작. **혼란 유발.** |
| 문서의 의도 | 5절 356~359행에서 "소유자 이름이 필요한 상세 화면에서는 별도 쿼리"라고 서술. 결제 수단 정보 보존에 대한 명시적 의도 없음. |

**판정: 실제 이슈 (Major) — 구현 전 설계 결정 필요**

**수정 제안** (택 1):

- **방안 A (권장)**: `payment_methods_select_policy`에서 `deleted_at IS NULL` 조건을 제거하고, soft-deleted 결제 수단도 조회 가능하게 함. 기존 `profiles` 패턴과 일관. 결제 수단 목록 UI에서는 앱 레이어에서 `deleted_at IS NULL` 필터 적용.
- **방안 B**: 현재 동작을 의도적으로 수용하고, "삭제된 결제 수단은 과거 거래에서도 표시되지 않음"을 문서에 명시. UI에서 "삭제된 결제 수단" 폴백 표시.
- **방안 C**: `active_transactions` 뷰에서 `security_invoker`를 제거하고 별도 RLS 처리 — 보안 우회 위험으로 **비추천**.

### [Info] I8. 기존 soft_delete 함수들의 anon REVOKE 미적용

- **위치**: schema.sql:1762-1782 (기존 코드)
- **내용**: 문서의 `soft_delete_payment_method`는 올바르게 `REVOKE FROM anon` + `GRANT TO authenticated`를 적용. 기존 `soft_delete_category`, `soft_delete_transaction` 등에는 `GRANT ALL TO anon`이 설정되어 있음.
- **실제 위험**: 함수 내부의 `auth.uid()` 검증이 anon 호출을 방어하므로 데이터 변경은 불가. 다만 방어 계층 추가(defense-in-depth) 관점에서 기존 함수에도 REVOKE 적용이 바람직.
- **판정**: 기존 코드의 보안 부채. 이번 문서 범위 외이나, 별도 마이그레이션으로 일괄 적용 권장.

---

## 4. 안전 확인된 설계 포인트

다음 항목들은 검증 결과 이슈가 없음을 확인했다:

| 항목 | 검증 결과 | 근거 |
|------|-----------|------|
| CHECK 제약 ENUM 호환성 | **안전** | PostgreSQL이 `'expense'` 문자열을 `category_type` ENUM으로 자동 캐스팅. 기존 schema에도 동일 패턴 사용 (budget_vs_actual 뷰). |
| 트리거 실행 순서 | **안전** | `check_transaction_category_type_trigger`(category)와 `check_transaction_payment_method_match`(payment)는 알파벳순 실행되며, 검증 대상이 완전히 독립적. 상호 의존성/충돌 없음. |
| soft-deleted 참조 거래 UPDATE | **안전** | `IS DISTINCT FROM` 조건으로 payment_method_id가 변경되지 않은 UPDATE를 건너뜀. 문서 162행에 설계 의도도 명시. |
| soft_delete_payment_method 보안 | **안전** | `SECURITY DEFINER` + `SET search_path TO 'public'` + `auth.uid()` 검증 + `deleted_at IS NULL` 이중 가드. 기존 패턴보다 방어적. |
| 테이블/뷰 GRANT | **안전** | `DEFAULT PRIVILEGES FOR ROLE postgres`가 자동 적용. DROP+CREATE 후에도 postgres 역할로 생성하면 자동 GRANT. |
| security_invoker 재적용 | **안전** | 문서 349~350행에 명시적 재적용 포함. 기존 마이그레이션 패턴 참조. |
| anon 역할 접근 차단 | **안전** | RLS의 `auth.uid()` 서브쿼리에서 anon(uid=NULL)은 항상 빈 결과. DELETE 정책 미생성 + RLS 활성화로 DELETE도 차단. |
| force_clean_user 호환성 | **안전** | 기존 방어적 패턴(명시적 NULL 처리)과 일관. FK ON DELETE SET NULL과 중복이나, 단일 트랜잭션 내 실행으로 race condition 없음. |
| ON DELETE SET NULL + CHECK 조합 | **안전** | payment_methods hard delete 시 `payment_method_id = NULL`이 되며, `CHECK (type = 'expense' OR payment_method_id IS NULL)`을 통과 (NULL은 CHECK 만족). |
| ADR-1 (is_shared 분리) | **우수** | ON DELETE SET NULL 시나리오의 의미 오염을 사전 차단. |
| cross-ledger 트리거 설계 | **우수** | INSERT 시 항상 검증, UPDATE 시 payment_method_id 변경 시에만 검증. soft-deleted 수단 참조 UPDATE 문제를 정교하게 해결. |

---

## 5. 결론

### 구현 전 필수 조치

1. **I1 (Critical)**: ADR-7을 재검토하고, `prevent_ledger_id_change` 트리거를 payment_methods(및 categories)에 도입할지 결정
2. **I2 (Major)**: is_shared=true인 공동 수단의 이름 유일성 정책을 결정하고, 필요 시 세 번째 unique index 추가 또는 CHECK 제약 추가
3. **I7 (Major)**: `active_transactions` 뷰에서 soft-deleted 결제 수단 정보의 RLS 필터링 동작을 결정. SELECT RLS 조건 수정(방안 A) 또는 현재 동작 문서화(방안 B) 택 1

### 권장 조치

4. **I3 (Minor)**: process_account_deletions 호출 관계 서술 오류 수정
5. **I4 (Minor)**: cleanup_old_deleted_data 내 payment_methods DELETE 위치를 transactions 직후로 변경 고려
6. **I5 (Minor)**: process_account_deletions_clean에 방어적 owner_id NULL 처리 추가 명시

### 참고

7. **I6, I8 (Info)**: COMMENT 보완, 기존 anon REVOKE 부채 해결은 별도 작업으로 계획
