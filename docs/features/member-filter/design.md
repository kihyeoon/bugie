# 거래 목록 멤버 필터 설계 (BGI-43)

공유 가계부의 거래 목록에서 "내 거래만", "배우자 거래만" 골라 본다.

> 개정 이력
> - 2026-09-27 초안. 사용자 결정: 적용 범위 A(목록 + 목록 캘린더), 누르면 열리는 선택 방식, 라벨 수정 포함.
> - 2026-09-27 재검토 반영. DB, 데이터 흐름, UI 세 관점으로 검토했다.
>   - 탈퇴 시나리오를 정정했다.
>   - 스크롤 정리 규칙과 유효 멤버 계산을 추가했다.
>   - 활성 알약 색을 대비 기준에 맞게 바꿨다.
>   - 라벨을 "지출한 사람"으로 정했다.
>   - 없는 입력 경로 결정을 삭제했다.

## 1. 문제

공유 가계부는 가계부 단위로만 볼 수 있어서 개인 지출을 파악할 수 없다.
PRD·MVP 계획에 없던 새 요구다.

## 2. 목표 / 비목표

- **목표**
  - 거래 목록 화면(`app/transactions.tsx`)에서 멤버 한 명을 골라 그 사람의 거래만 본다.
  - 목록, 캘린더 일별 합계, 월 합계 푸터가 **같은 기준으로** 바뀐다.
- **목표(보조)**: 수입에도 "지출자"라고 쓰는 라벨을 "지출한 사람 / 받은 사람"으로 고친다(§6.5).
- **비목표**
  - 홈 화면(캘린더·월 요약)에는 적용하지 않는다. RPC는 이번에 준비되므로 필요하면 별도 이슈로 붙인다.
  - 여러 멤버 동시 선택, 다른 필터(카테고리·검색 BGI-45)와의 조합은 하지 않는다.
  - 인덱스를 추가하지 않는다(§7).

## 3. 결정 사항

| 항목 | 결정 |
| --- | --- |
| 기준 | **"누구의 거래인가" = `coalesce(paid_by, created_by)`**. 수입·지출 같은 규칙(§4) |
| 적용 범위 | 거래 목록 + 목록 화면 캘린더 + 월 합계 푸터 (A안). 홈은 그대로 |
| UI | 헤더 아래 필터 버튼 → 바텀시트에서 선택 (§6) |
| 상태 유지 | 목록 화면 안에서만. 상세에 다녀와도 유지, 화면을 나가면 "전체" |
| 가계부 전환·멤버 이탈 | 선택한 멤버가 현재 가계부 멤버가 아니면 "전체"로 본다(§6.3) |
| 탈퇴 멤버 | 필터 선택지에 없다. 그 거래는 "전체"에서만 보인다(§4.2) |
| 개인 가계부 | 멤버 1명이면 필터 버튼을 그리지 않는다 |

**입력 후 필터 처리는 정할 필요가 없다.** 목록 화면은 홈에서 push되는 루트 스택 화면이고, 여기서 빠른입력으로 가는 경로가 없다. 입력 탭으로 가려면 목록을 닫아야 하고, 그 순간 필터도 사라진다. 저장하면 `router.replace('/(tabs)')`로 이동한다.

## 4. 기준 규칙 — "누구의 거래인가"

### 4.1 왜 `coalesce(paid_by, created_by)`인가

- `paid_by`는 2026-03-02에 추가됐다(`specs/transaction/2026-03-02-paid-by-field.md`). 설계 당시부터 **"NULL이면 `created_by`와 동일인으로 간주"**가 규칙이다.
- 상세 화면도 이미 이 규칙으로 표시한다(`transaction-detail.tsx`의 지출자 행: `paid_by ? paid_by_name : created_by_name`). 필터도 같은 규칙이어야 "상세에서 김철수로 보이는 거래가 김철수 필터에 나온다".
- 빠른입력은 **수입·지출 모두** 멤버를 고르게 하고 기본값은 "나"다(`add.tsx`). 새 거래는 둘 다 `paid_by`가 채워진다.
  - Linear 이슈의 "수입은 `paid_by`가 NULL"은 seed 데이터에만 해당한다.

프로덕션 실측 (2026-09-27, 삭제 제외):

| 타입 | 전체 | `paid_by` NULL (레거시) | `paid_by` ≠ 작성자 |
| --- | --- | --- | --- |
| 수입 | 96 | 11 | 0 |
| 지출 | 972 | 48 | **53** (전부 공유 가계부) |

- 작성자와 지출자가 다른 지출이 53건 있다. 작성자 기준으로 필터하면 틀린다.
- NULL 59건은 `paid_by` 도입 전 거래다. `paid_by`만 보면 이 거래들이 필터에서 사라진다.

### 4.2 알려진 한계 — 탈퇴·나간 멤버

탈퇴는 두 단계로 진행된다.

1. **탈퇴 요청 즉시(T=0)**
   - `ProfileService`가 `removeUserFromAllLedgers`로 멤버십을 지운 뒤 프로필을 soft delete한다.
   - B는 필터 선택지에서 바로 빠진다. B의 거래는 아직 B의 id를 가지고 있어서 **"전체"에서만** 보인다.
2. **30일 뒤 배치**
   - `process_account_deletions()`가 `profiles`를 삭제한다.
   - FK `ON DELETE SET NULL`로 `created_by`와 `paid_by`가 각각 NULL이 된다.
   - 그래서 **B가 쓰고 A가 입력한 거래**(`paid_by=B`, `created_by=A`)는 `paid_by`만 NULL이 되어 **A의 거래로 넘어간다.**
   - A 필터의 과거 월 합계가 소급해서 바뀐다.
   - 상세 화면의 지출자 표시도 같은 시점에 A로 바뀐다. 이번에 새로 생기는 문제는 아니고, 고치려면 탈퇴 처리를 바꿔야 하므로 범위 밖이다.

그 밖의 경우는 다음과 같다.

- 탈퇴를 취소해 복구해도(`restore_deleted_account`) 멤버십은 돌아오지 않는다. 다시 초대받기 전까지 선택지에 없다.
- 가계부만 나간 멤버는 멤버십 행이 지워지고 거래의 id는 남는다. 그 거래는 "전체"에서만 보인다.
- 두 컬럼이 모두 NULL인 거래도 "전체"에서만 보인다.

### 4.3 규칙이 두 곳에 있다

| 위치 | 표현 |
| --- | --- |
| RPC `get_daily_summary` (캘린더 합계) | `coalesce(t.paid_by, t.created_by) = p_member_id` |
| 리포지토리 (목록) | PostgREST `.or('paid_by.eq.<id>,and(paid_by.is.null,created_by.eq.<id>)')` |

둘이 어긋나면 캘린더와 목록이 다른 거래를 센다. 검증(§9)에서 seed의 레거시 NULL 거래와 작성자≠지출자 거래로 양쪽 결과가 같은지 확인한다.

**필터와 무관한 기존 불일치가 있다.**
- 목록은 `active_transactions` 뷰를 읽는다. 이 뷰는 `category_details`와 inner join해서 **삭제된 카테고리의 거래를 뺀다.**
- RPC는 `transactions`를 직접 읽어서 그 거래까지 합산한다.
- 카테고리를 삭제한 가계부에서는 필터가 없어도 캘린더와 목록이 다를 수 있다. 필터 버그로 오진하지 않는다. 이번 범위 밖이다.

## 5. 데이터 · 쿼리

### 5.1 마이그레이션 — `get_daily_summary`에 멤버 인자 추가

`create or replace`로 인자를 추가하면 Postgres는 **오버로드를 하나 더 만든다.** 그러면 PostgREST가 3인자 호출을 어느 함수로 보낼지 못 정해 에러(PGRST203)가 난다. 그래서 기존 시그니처를 먼저 지운다.

```sql
-- BGI-43: 멤버 필터. p_member_id가 null이면 기존과 동일(가계부 전체)
drop function public.get_daily_summary(uuid, int, int);

create function public.get_daily_summary(
  p_ledger_id uuid,
  p_year int,
  p_month int,
  p_member_id uuid default null
)
returns table (summary_date date, income numeric, expense numeric, transaction_count bigint)
language sql
stable
set search_path = public
as $$
  select
    t.transaction_date,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
    count(*)
  from transactions t
  where t.ledger_id = p_ledger_id
    and t.deleted_at is null
    and t.transaction_date >= make_date(p_year, p_month, 1)
    and t.transaction_date < (make_date(p_year, p_month, 1) + interval '1 month')
    -- "누구의 거래": 지출자, 없으면 작성자 (docs/features/member-filter/design.md §4)
    and (p_member_id is null or coalesce(t.paid_by, t.created_by) = p_member_id)
  group by t.transaction_date
  order by t.transaction_date;
$$;

revoke execute on function public.get_daily_summary(uuid, int, int, uuid) from anon, public;
grant execute on function public.get_daily_summary(uuid, int, int, uuid) to authenticated, service_role;

comment on function public.get_daily_summary(uuid, int, int, uuid) is
  '가계부의 월별 일간 수입/지출/건수 집계. p_member_id로 멤버 필터(지출자, 없으면 작성자). RLS 적용(SECURITY INVOKER) — DEFINER로 바꾸지 말 것.';

notify pgrst, 'reload schema';
```

- **`SECURITY INVOKER`를 유지하고 `deleted_at` 필터는 본문에 둔다**(BGI-36, CLAUDE.md).
  - INVOKER이고 `transactions` RLS가 걸리므로, 다른 가계부의 id를 넣어도 데이터가 새지 않는다.
- **권한**
  - drop하면 기존 GRANT도 사라진다. 그래서 새 시그니처에 다시 부여한다.
  - 함수의 EXECUTE는 기본으로 PUBLIC과 anon에 열린다. `20260830000013`은 테이블 권한만 거뒀다. 그래서 둘 다 회수한다. `20260830000012`의 함수 권한 처리와 같은 방식이다.
- `set search_path = public`을 추가했다. Supabase advisor 경고(function_search_path_mutable)를 피하고 최근 함수들과 맞춘다.
- `notify pgrst`
  - Supabase는 DDL 이벤트 트리거로 스키마 캐시를 자동으로 다시 읽는다. 그래도 몇 번 실행해도 무해하니 명시해 둔다.
- **하위 호환**
  - 4번째 인자에 기본값이 있다. 그래서 1.5.1 이하 앱과 web의 3인자 이름 지정 호출은 그대로 동작한다. DB를 앱보다 먼저 배포해도 된다.
  - drop과 create가 한 마이그레이션 파일이라 한 트랜잭션으로 실행된다. 함수가 없는 순간이 생기지 않는다.
  - 의존하는 SQL 함수, 뷰, 스크립트는 없다. 호출처는 `TransactionRepository.getMonthlySummary` 하나다.
- **`database-generated.ts`는 고치지 않는다.**
  - `Functions` 블록에 `get_daily_summary` 항목이 원래 없다(블록 자체가 오래됐다).
  - core 리포지토리는 제네릭 없는 `SupabaseClient`를 써서 RPC 인자 타입을 검사하지 않는다.

### 5.2 core

지나가는 경로는 다음과 같다. `memberId`는 전부 optional이라 web은 변경이 없다.

| 층 | 변경 |
| --- | --- |
| application `TransactionFilterInput` | `memberId?: string` (주석: "지출자, 없으면 작성자") |
| domain `TransactionFilter` | `memberId?: EntityId` |
| `TransactionService.getTransactions` | 인라인 필터 변환(`TransactionService.ts:50-60` 부근)에 한 줄 추가 |
| domain 포트 `TransactionRepository.getMonthlySummary` | `(ledgerId, year, month, memberId?)` — **인터페이스부터 바꿔야** 서비스 타입이 통과한다 |
| `TransactionService.getMonthlySummary` / `getCalendarSummary` | `memberId?`를 받아 포트로 전달 |
| infra `TransactionRepository.getMonthlySummary` | `p_member_id: memberId`로 넘긴다. `?? null`을 쓰지 않는다. undefined는 요청 본문에서 빠져 필터 없는 호출이 기존 3인자 형태로 나간다 |
| infra 목록 조회 | `findWithDetails`(뷰)와 `findByFilter`(테이블) 둘 다 §4.3의 `.or` 조건을 건다 |

- `findByFilter`는 지금 호출처가 없다. 그래도 같은 `TransactionFilter`를 받으면서 `memberId`를 조용히 무시하면 함정이 된다.
  - 조건 문자열은 infrastructure에 작은 함수 하나(`memberFilter(memberId)`)로 두고 두 곳이 같이 쓴다.
- `memberId`는 uuid라 PostgREST 필터 문법을 깨는 문자가 없다. 값은 **가계부 멤버 목록에서 고른 것만** 들어오게 한다.
- 인자 이름을 `paidBy`가 아니라 `memberId`로 한 것은 규칙이 `paid_by` 단독이 아니기 때문이다.

### 5.3 native 쿼리 키

- **"필터 없음"은 화면부터 core까지 `undefined` 하나로 표현한다(`null`을 쓰지 않는다).**
  - TanStack의 키 해시는 JSON 직렬화다. 객체 안의 `undefined` 속성은 빠지고, `null`은 남는다.
  - 목록 "전체"가 `{memberId: null}`이 되면 홈의 `{}`와 해시가 달라진다. 그러면 같은 달 캐시를 공유하지 못하고 중복 요청과 로딩이 생긴다.
- **`useTransactions`**: `UseTransactionsOptions`와 `queryClient.ts`의 `TransactionFilters`에 `memberId?`를 추가한다.
- **`useMonthlyData(year, month, memberId?)`**
  - 키를 `monthlySummary.month(ledgerId, year, month, memberId)`로 바꾼다.
  - 배열 안의 `undefined`는 `null`로 직렬화되므로 홈(인자 없음)과 목록 "전체" 키가 같다.
  - 홈(`index.tsx`)과 목록은 같은 훅을 쓴다. 키를 나누지 않으면 목록의 필터된 집계가 홈 캐시를 덮어써 홈 합계가 한 사람 것으로 바뀐다.
  - **인접 월 prefetch는 필터가 없을 때만 한다.**
    - 목록은 미리 받지 않으므로, 필터 중에 집계만 미리 받아도 달을 넘길 때 어차피 기다린다.
    - 반대로 멤버를 둘러볼 때마다 요청은 세 배가 된다.
- **무효화는 바꾸지 않는다.**
  - 모든 무효화(입력, 상세 수정·삭제, 카테고리, 결제 수단, 프로필)가 `.all` 접두어 기반이라 필터된 캐시도 함께 stale이 된다.
  - 목록·집계 키에 `setQueryData`를 쓰는 곳은 없다. 상세의 낙관적 반영은 `queryKeys.transaction(id)`에만 쓴다.
  - 예: "이영희" 필터에서 상세에 들어가 지출한 사람을 김철수로 바꾸고 돌아오면, `useFocusEffect` 재조회로 목록과 캘린더에서 그 거래가 빠진다.

## 6. UI

### 6.1 배치 — 헤더 오른쪽 (월 표시는 가운데)

```
┌─────────────────────────────────┐
│ ‹        ◀ 9월 ▶       [이영희 ⌄] │  ScreenHeader(fitCenter) — 필터는 공유 가계부만
│  일  월  화  수  목  금  토       │  캘린더 (기존, 스크롤에 따라 접힘)
│  ...                            │
```

> 2026-09-27 변경: 처음엔 헤더 아래 별도 줄(필터 바)에 뒀다. 월 표시 오른쪽이 비어 있다는 사용자 의견으로 헤더로 옮겼다. 목록 영역이 세로로 약 44pt 넓어진다.

- **`ScreenHeader`의 `fitCenter` 옵션**
  - 가운데 칸은 월 표시 폭만큼만 차지한다. 좌/우 칸은 `flex: 1`로 남는 공간을 똑같이 나눈다.
  - 그래서 월 표시는 오른쪽 내용과 상관없이 **항상 화면 가운데**에 온다. 개인 가계부처럼 오른쪽이 비어도 같다.
  - 가운데 칸 좌우에 같은 여백(8)을 둬서 필터가 ▶에 붙지 않게 한다. 양쪽이 같은 값이라 가운데 정렬은 그대로다.
  - 기본값(false)은 기존대로 좌/우 44 고정이라 다른 화면은 영향이 없다.
- **필터는 남는 공간 안에서만 줄어든다.**
  - 알약은 `maxWidth: '100%'`, 라벨은 `flexShrink: 1`이다. 이름이 길면 칸 폭 안에서 말줄임된다.
  - 이름 칸은 대략 iPhone 17 Pro(402pt)에서 한글 5자, SE(375pt)에서 3~4자다. 닉네임은 최대 20자다.
  - 17 Pro에서는 20자 닉네임이 "이영희아주…"로 잘리는 것을 확인했다. SE는 폭 계산으로 추정한 값이다(시뮬레이터 자동 조작이 안 됐다).
- 헤더 오른쪽이 44 고정일 때는 이름이 들어가지 않았다. 또 아이콘만으로는 **지금 누구를 보고 있는지** 알 수 없어서 알약에 이름을 띄운다. 필터가 캘린더 합계까지 바꾸므로 선택 상태가 항상 보여야 한다.

**필터 버튼 (드롭다운 알약)**

| 상태 | 모양 |
| --- | --- |
| 전체 | `전체 ⌄` — `backgroundSecondary` 배경, `text` 색 |
| 멤버 선택 | `김철수 ⌄` — `tintLight` 배경, `text` 색, 600 굵기 |

- 활성 글자를 `tint`로 하지 않는 이유는 대비 때문이다.
  - `tintLight` 배경에 `tint` 글자는 라이트 3.31:1, 다크 2.91:1로 작은 글씨 기준(4.5:1)에 못 미친다.
  - 기존 시트의 선택 행도 `tintLight` 배경 + `text` 글자다.
- 화살표는 문자 `▾`가 아니라 Ionicons `chevron-down`을 쓴다(`LedgerSelector` 선례). 아이콘 색은 `textSecondary`다.
- 크기는 높이 32, 가로 여백 12, 반지름 16(알약)이다. 44pt 터치 기준을 맞추려고 `hitSlop`을 둔다.
- 이름은 한 줄로 말줄임한다(§6.1). 나를 골랐어도 **이름**을 띄운다. 시트와 빠른입력처럼 이름이 기준이다.
- `Pressable`에 `accessibilityRole="button"`, `accessibilityLabel="멤버별로 보기, 현재 {전체|이름}"`을 단다.

### 6.2 선택 시트

```
┌─────────────────────────────────┐
│          멤버별로 보기            │
│  전체                        ✓  │
│  김철수  [나]                    │
│  이영희                          │
└─────────────────────────────────┘
```

기존 `PaidByBottomSheet`를 `MemberSelectSheet`로 일반화한다. `PaymentMethodBottomSheet`의 "선택 안 함" 행을 선례로 따른다.

- **props**
  - `title`을 추가하고, `onSelectAll?`을 추가한다. `onSelectAll`이 있을 때만 "전체" 행을 그리고, `selectedUserId === null`이면 그 행에 체크를 표시한다.
  - `onSelect`의 타입(`(userId: string) => void`)은 넓히지 않는다.
- **스크롤**
  - 지금은 행을 `ScrollView` 없이 그리고 `heightRatio`가 0.4다. SE에서는 "전체 + 2명"이 한계다(멤버 상한 20명).
  - 행 목록을 `ScrollView`로 감싸고 `heightRatio`는 `PaymentMethodBottomSheet`처럼 0.55로 한다.
- 새로 고치는 코드이므로 행을 `TouchableOpacity`에서 `Pressable`로 바꾼다(CLAUDE.md). 행에 `accessibilityState={{ selected }}`를 단다.
- **순서**
  - 시트는 받은 순서대로 그린다. 필터 화면만 **나를 맨 앞으로** 정렬해서 넘긴다.
  - native `ledger_members`에는 `joined_at`이 없어 가입 순 정렬은 하지 않는다. 빠른입력·상세 시트 순서는 그대로다.
- 고르면 기존처럼 체크 애니메이션 후 닫힌다.

### 6.3 상태와 동작

- **상태**: `transactions.tsx`에 `useState<string | null>(null)`(null = 전체)로 둔다.
- **유효 멤버는 렌더 중에 계산한다(effect로 되돌리지 않는다).**
  ```ts
  const members = currentLedger?.ledger_members ?? [];
  const memberId = members.some((m) => m.user_id === selectedMemberId) ? selectedMemberId : null;
  ```
  - 가계부를 전환하거나 선택한 멤버가 나가면 자동으로 "전체"가 된다.
  - effect로 상태를 되돌리면, 새 가계부 id와 이전 멤버 id 조합으로 한 번 렌더되어 불필요한 요청과 빈 캐시가 생긴다.
  - 멤버가 1명이면 버튼이 없으므로 항상 null이다.
- **필터를 바꿀 때 스크롤 상태를 정리한다.** 두 곳에서 나눠 처리한다.
  - 월 전환 리셋 effect의 의존성에 `memberId`를 추가한다. 이 effect가 `debouncedDateUpdate.cancel()`을 하고, `hasScrolledToInitialDate`와 `userHasDraggedSinceChange`를 false로 되돌린다.
    - 리셋하지 않으면, 전에 드래그한 적이 있을 때 새 목록이 그려지면서 `onViewableItemsChanged`가 맨 위 날짜로 `selectedDate`를 덮어써 캘린더 선택이 튄다.
  - 선택 핸들러(`handleMemberChange`)에서는 다음을 한다.
    - 예약된 스크롤 타이머를 `clearTimeout`하고 `isProgrammaticScroll = false`로 둔다. 살아 있는 타이머는 옛 날짜로 다시 스크롤하기 때문이다.
    - 목록을 맨 위로 올린다. `scrollToLocation` 대신 빈 목록에서도 안전한 `getScrollResponder()?.scrollTo({ y: 0, animated: false })`를 쓴다.
  - `selectedDate`는 유지한다. 새 목록에 그 날짜 섹션이 있으면 월 전환과 같은 자동 스크롤 경로로 그 날짜로 이동한다.
  - **알려진 한계 (기존 동작)**
    - 캐시된 목록이 오래돼 선택 날짜 섹션이 없으면, 자동 스크롤은 "시도함"으로 끝난다. 그 뒤 재조회로 섹션이 생겨도 다시 이동하지 않는다.
    - 월 전환에도 있는 동작이라 이번 범위에서 고치지 않는다.
- **멤버를 바꿔도 캘린더 금액이 비지 않는다.**
  - 새 키라서 원래는 데이터가 올 때까지 캘린더 금액이 비었다가 채워진다. 2026-09-27 사용자가 이 깜빡임을 지적했다.
  - `useMonthlyData`의 `placeholderData`는 **같은 달(가계부·연·월이 같은 키)일 때만** 이전 금액을 둔다. 달이 바뀌면 두지 않는다. 다른 달 금액을 이 달 것처럼 보여주지 않는다는 기존 원칙 때문이다.
  - 목록에는 적용하지 않았다. 목록의 이전 데이터는 자동 스크롤과 `isStaleData` 판정에 섞여 옛 목록 기준으로 스크롤할 수 있다. 목록은 처음 고른 멤버에서 한 번 로딩 상태가 된다.
  - 한 번 받은 멤버·월은 캐시에서 바로 나온다. 필터 중엔 인접 월을 미리 받지 않는다(§5.3).

### 6.4 빈 상태

| 필터 | 문구 |
| --- | --- |
| 전체 | 이 달에는 거래가 없어요 (기존) |
| 나 | 이 달에는 내 거래가 없어요 |
| 다른 멤버 | 이 달에는 김철수님의 거래가 없어요 |
| 이름 없음(`full_name` null) | 이 달에는 이 멤버의 거래가 없어요 |

월 합계 푸터는 이미 목록 데이터로 계산하므로 필터가 자동으로 반영된다(`transactions.tsx`의 `MonthTotalsFooter`). 라벨은 그대로 둔다.

### 6.5 "지출자" 라벨 → 지출한 사람 / 받은 사람

- 빠른입력과 상세 모두 수입에도 "지출자"라고 쓴다. 수입에서 이 값은 **받은 사람**이다. 컬럼과 데이터는 그대로 두고 문구만 바꾼다.
- **"쓴 사람"이 아니라 "지출한 사람"으로 한다.**
  - 상세에서는 이 행 바로 아래가 "작성자"다.
  - "쓴 사람"은 "(글을) 쓴 사람"으로도 읽혀 작성자와 같은 뜻으로 보인다.

| 위치 | 지금 | 지출 | 수입 |
| --- | --- | --- | --- |
| 상세 정보 행 라벨 (`transaction-detail.tsx`) | 지출자 | 지출한 사람 | 받은 사람 |
| 상세 시트 제목 | 지출자 변경 | 지출한 사람 선택 | 받은 사람 선택 |
| 빠른입력 시트 제목 (`add.tsx`, 수입/지출 토글에 따라 바뀜) | 지출자 변경 | 지출한 사람 선택 | 받은 사람 선택 |
| 상세 변경 실패 Alert | 지출자 변경에 실패했습니다. | 변경에 실패했습니다. | 변경에 실패했습니다. |

- 빠른입력 필드는 보이는 라벨 없이 아이콘 + 이름이다. 그래서 라벨을 바꾸는 곳은 시트 제목뿐이다.
- **빠른입력의 `full_name || '지출자 선택'`은 버그라서 함께 고친다.**
  - 선택된 멤버의 이름이 null이면 "선택 안 됨"처럼 보인다.
  - 시트처럼 `'멤버'`로 대체한다.
- `apps/web`과 `docs/screen-design.md`에는 "지출자" 문구가 없다. 코드 주석과 변수명(`paidBy`)은 그대로 둔다.

## 7. 하지 않는 것

- **인덱스를 추가하지 않는다.**
  - `(ledger_id, paid_by, transaction_date)` 같은 인덱스를 두지 않는다.
  - 프로덕션 거래는 1,068건이다.
  - 조건이 `coalesce`와 `or` 형태라 그런 인덱스를 타지 않는다.
  - 기존 `idx_transactions_ledger_date (ledger_id, transaction_date desc) where deleted_at is null`로 한 달 범위를 먼저 좁히면 충분하다.
- 홈 화면 필터: RPC는 준비되지만 UI는 이번 범위가 아니다.
- 삭제된 카테고리 때문에 생기는 캘린더와 목록의 불일치(§4.3)는 고치지 않는다.
- 탈퇴 시 거래 소유가 넘어가는 문제(§4.2)는 고치지 않는다.

## 8. 작업 목록

1. **마이그레이션**
   - `supabase/migrations/2026MMDDHHMMSS_get_daily_summary_member_filter.sql`를 작성한다(§5.1).
   - 로컬에서 적용하고 확인한다.
2. **core**
   - `TransactionFilterInput`/`TransactionFilter`에 `memberId`를 추가하고, `getTransactions` 변환부를 고친다.
   - domain 포트, 서비스, infra의 `getMonthlySummary` 경로에 `memberId`를 넘긴다.
   - `memberFilter` 함수를 만들어 `findWithDetails`와 `findByFilter`에 적용한다.
3. **native 훅**
   - `queryClient.ts`: `TransactionFilters`와 `monthlySummary.month` 시그니처를 바꾼다.
   - `useTransactions`: 옵션에 `memberId?`를 추가한다.
   - `useMonthlyData`: 인자와 키에 `memberId?`를 넣고, prefetch는 필터가 없을 때만 한다.
4. **시트 일반화**: `PaidByBottomSheet`를 `MemberSelectSheet`로 바꾼다(title, `onSelectAll`, `ScrollView`, `Pressable`, 0.55). 빠른입력·상세 호출부도 고친다.
5. **라벨**(§6.5): 상세 행·시트 제목·Alert와 빠른입력 시트 제목을 바꾸고, `'지출자 선택'` 대체 문구를 고친다.
6. **목록 화면**: `MemberFilter`(알약 + 시트)를 헤더 오른쪽에 두고(`ScreenHeader` `fitCenter`), 유효 멤버 계산, 필터 변경 시 스크롤 정리, 빈 상태 문구를 넣는다.
7. **검증**(§9)
8. **Linear 정리**: BGI-43 본문의 "수입은 `paid_by` NULL" 문구를 정정하고 결과를 기록한다.

## 9. 검증

로컬 Supabase와 seed로 확인한다.
- seed에는 김철수·이영희 공유 가계부가 있다.
- `paid_by`가 NULL인 수입이 2건 있다.
- 작성자≠지출자 거래로 "생필품 구매"(작성 김철수, 지출 이영희)가 있다.
- seed를 따로 조작할 필요는 없다.

- **SQL**
  - `db reset` 후 `\df get_daily_summary`로 4인자 함수 **하나만** 있는지 확인한다.
  - 3인자 호출이 변경 전과 같은 결과인지 확인한다.
  - anon 역할로 EXECUTE가 거부되는지 확인한다.
- **규칙 일치**
  - 김철수 필터에서 "생필품 구매"가 빠지고, 이영희 필터에 나오는지 확인한다.
  - `paid_by`가 NULL인 수입이 작성자 필터에 나오는지 확인한다.
  - 필터별로 캘린더 일별 합계와 목록 합계가 같은지 확인한다. seed에는 삭제된 카테고리가 없다.
- **화면**
  - 개인 가계부(`new@test.com`)에는 필터 버튼이 없고, 월 표시는 가운데 그대로다.
  - 멤버를 고르면 목록, 캘린더 금액, 푸터가 함께 바뀐다.
  - 필터 상태에서 홈으로 돌아가면 홈 합계는 전체 그대로다(캐시 분리).
  - 월을 넘겨도 필터가 유지되고, 넘긴 달도 필터된 값이다.
  - 목록을 드래그한 뒤 필터를 바꾸면 맨 위로 가고, 캘린더 선택 날짜가 튀지 않는다.
  - 날짜를 누른 직후 필터를 바꿔도 크래시가 없고 옛 날짜로 다시 스크롤하지 않는다.
  - 상세에서 지출한 사람을 바꾸고 돌아오면 필터 결과에 반영된다.
  - 가계부를 전환하면 전체로 돌아간다.
  - 라벨: 지출 거래 상세는 "지출한 사람", 수입 거래 상세는 "받은 사람"이다. 빠른입력에서 수입/지출을 토글하면 시트 제목이 바뀐다.
  - 멤버 4명 이상일 때 시트가 스크롤되는지 확인한다. seed에 멤버를 임시로 추가해서 본다.
  - 다크모드에서 필터 버튼 활성·비활성 모습을 확인한다.
- **정적 검사**
  - `pnpm --filter @repo/core lint`
  - `apps/native`에서 `npx tsc --noEmit`
  - `pnpm --filter native lint`
