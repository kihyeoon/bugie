# 거래 검색 설계 (BGI-45)

지난 거래를 제목이나 메모로 찾는다. 기간은 가계부 전체다.

> 개정 이력
> - 2026-09-27 초안. 사용자 결정: 제안 추천안 그대로.
>   - 대상은 제목·메모, 진입은 홈 아이콘에서 여는 검색 전용 화면이다.
>   - 기간은 전체, 결과는 날짜 그룹, 1차는 다른 필터와 조합하지 않는다.
>   - 메모 일치 표시, 1자 허용, 최근 검색어 없음.
>   - 이슈 본문과 달라진 점: `pg_trgm` 인덱스를 두지 않는다(§7).
> - 2026-09-27 1.6.0 빌드 27 TestFlight 피드백: 검색어를 고치는 동안 "N건" 줄이 숨었다 나타나며 목록이 튀었다 → 흐린 동안에도 둔다(§6.3).
> - 2026-09-27 재검토 반영. DB·보안, 데이터 흐름·캐시, UI 세 관점으로 검토했다.
>   - **20건씩 이어 받기를 한 번에 받기(상한 1,000건)로 바꿨다**(§5.4).
>     - 이어 받기 캐시 모양이 거래 상세 화면을 죽인다(§8).
>     - RPC가 어차피 페이지마다 전체 결과를 만든다.
>     - 페이지마다 순차 왕복이 3번이다.
>   - 메모에서만 걸린 행의 두 번째 줄을 `메모 · …스니펫`으로 바꿨다(§6.4). 좁은 화면에서 검색어가 잘렸다.
>   - 입력 끝의 조합 중 자모("김ㅂ")를 떼고 검색한다(§4).
>   - 안내 문구를 검색 범위로 바꿨다.
>   - 뷰를 다시 만들 때의 함정을 키웠다(§8). 기존 목록까지 42501이 된다.
>   - `pg_trgm` 설명을 정정했다(§7).
>   - 입력칸 색·키보드·접근성 속성, 상태 화면 위치, 홈 아이콘 터치 영역을 정했다.

## 1. 문제

- 거래가 쌓이면 "그때 그 지출"을 찾을 방법이 캘린더로 월을 넘겨 보는 것뿐이다.
- 제목(최대 50자)과 메모(최대 200자)에 정보가 있는데 검색할 수 없다. MVP 계획에서 Phase 2로 미룬 항목이다.

## 2. 목표 / 비목표

- **목표**
  - 홈에서 검색 화면으로 들어가, 현재 가계부의 **전체 기간** 거래를 제목·메모로 찾는다.
  - 결과를 누르면 거래 상세로 가고, 돌아오면 검색어와 스크롤 위치가 그대로다.
- **비목표**: §7에 모았다. 요약하면 인덱스, 이어 받기, 카테고리·금액 검색, 최근 검색어, 일치 부분 강조, 필터 조합, web이다.

## 3. 결정 사항

| 항목 | 결정 |
| --- | --- |
| 검색 대상 | **제목 + 메모.** 카테고리명·결제수단명·금액은 하지 않는다 |
| 진입 | 홈 헤더(가계부 이름 줄) 오른쪽 🔍 → 새 스택 화면 `app/search.tsx` |
| 기간 | **전체 기간**, 최신순, **한 번에 받기(상한 1,000건)** |
| 결과 화면 | 거래 목록과 같은 날짜 그룹 + 거래 행. 올해가 아닌 날짜는 연도를 붙인다 |
| 다른 필터와 조합 | 1차는 안 한다. 멤버 조건은 나중에 붙이기 쉽게 둔다(§5.1) |
| 메모에서 찾은 결과 | 제목엔 없고 메모에만 있으면 두 번째 줄에 `메모 · …스니펫`(§6.4) |
| 최소 글자 수 | **1자부터.** "밥", "책" 같은 한 글자 검색어가 흔하다 |
| 최근 검색어 | 1차는 없다. 빈 화면엔 검색 범위 안내만 |
| 검색 시점 | 입력을 멈추고 300ms 뒤. 키보드의 검색 키를 누르면 바로 |

**거래 목록 화면에 검색을 넣지 않고 새 화면으로 뗀다.**
- 목록은 월 단위이고 캘린더 합계와 맞물려 있다. 검색은 전체 기간이다. 한 화면에 두면 "검색 중일 때 월 이동·캘린더는?"을 전부 예외로 다뤄야 한다.
- 목록 헤더는 뒤로가기·월·멤버 필터(BGI-43)로 이미 찼다.

## 4. 검색 규칙 — "무엇이 걸리는가"

- **대상 컬럼**: `title`, `description`. 둘 중 하나에 검색어가 들어 있으면 결과다.
- **부분 일치**: "김밥" → "아침 김밥", "삼각김밥". 형태소 분석은 하지 않는다.
- **대소문자 무시**: `lower()` 비교. "star" → "Starbucks".
- **검색어 전체를 한 덩어리로** 찾는다. "김밥 아침"은 "아침 김밥"에 걸리지 않는다. 단어별 AND 검색은 1차 범위 밖이다.
- **검색어 정리 `normalizeKeyword(input)`** (`@repo/core` `domain/transaction/search.ts`, 순수 함수. native엔 테스트 러너가 없어 vitest가 있는 core에 둔다)
  1. 앞뒤 공백을 자른다.
  2. **끝에 붙은 한글 호환 자모(U+3131–U+3163)를 뗀다.** 입력 중인 "김ㅂ"은 "김"으로 찾는다.
     - 낱자로 끝난 채 멈췄을 때 "'김ㅂ' 검색 결과가 없어요"가 번쩍이지 않는다.
     - **완성 글자로 끝나는 조합 중간("김바" → "김밥")은 막지 못한다.** 마지막 음절을 초성·중성·종성으로 분해해 비교해야 하고 DB 조건까지 바뀐다. 300ms 안에 다음 글자를 치면 보이지 않는다.
     - 자모만으로 된 검색어("ㅋㅋ")는 빈 검색어가 된다. 1차에서는 받아들인다.
  3. 결과가 비면 검색하지 않고 처음 화면을 보인다.
- **길이**: 입력칸 `maxLength` 50 (제목 최대 길이와 같다).
- **특수문자는 글자 그대로다.** `%`, `_`, `*`, `,`, `(`, `"`, `\`를 넣어도 와일드카드나 문법 오류가 되지 않는다(§5.1에서 이유).
- **보이는 범위는 거래 목록과 같다**: `active_transactions` 뷰를 읽으므로 삭제된 거래, 삭제된 가계부, **삭제된 카테고리의 거래**는 나오지 않는다. 마지막 것은 목록과 같은 기존 동작이다(member-filter 설계 §4.3).
- 유니코드 정규화(NFC/NFD)는 하지 않는다. iOS 키보드 입력은 NFC다. 다른 곳에서 붙여 넣은 NFD 문자열은 안 걸릴 수 있고, 1차 범위 밖이다.

프로덕션 실측 (2026-09-27, 삭제 제외):

| 항목 | 값 |
| --- | --- |
| 전체 거래 | 1,071 |
| 가계부 하나의 최대 거래 수 | **401** |
| 메모가 있는 거래 | 254 (24%) |
| 제목 평균 길이 | 5.6자 |
| 가장 오래된 거래 | 2025-01-01 |
| 제목에 `%`·`_`가 든 거래 | 0 |
| `pg_trgm` 설치 | 안 됨 |

- 메모가 있는 거래가 4건 중 1건이라, 메모를 대상에서 빼면 놓치는 결과가 많다.
- 가장 큰 가계부도 전체가 401건이라, 결과를 한 번에 받아도 된다(§5.4).

## 5. 데이터 · 쿼리

### 5.1 조회 방식 — RPC로 검색 조건만 DB에 둔다

PostgREST 필터(`.or('title.ilike.*kw*,description.ilike.*kw*')`)로도 되지만, 사용자 입력을 URL 필터 문법에 끼워 넣어야 해서 **세 겹의 이스케이프**가 필요하다.

1. `ilike`의 와일드카드 `%`·`_` → `\%`·`\_`
2. PostgREST가 `*`를 `%`로 바꾼다. **글자 그대로의 `*`를 표현할 방법이 없다.**
3. `.or()` 값에 `,` `.` `:` `(` `)`가 있으면 큰따옴표로 감싸야 하고, 그 안의 `"`·`\`를 다시 이스케이프해야 한다.

`1,000원 (50%)` 같은 입력은 세 가지에 다 걸린다. 그래서 검색 조건은 RPC 안에서 `strpos`로 처리한다. `strpos`에는 와일드카드가 없어 이스케이프할 것이 없고, 검색어는 JSON 본문으로 넘어간다.

**RPC는 조건만 맡고, 정렬·개수 제한은 클라이언트 쿼리 빌더가 붙인다.** 재검토에서 설치된 버전으로 확인했다.
- postgrest-js 1.19.4의 `rpc()`는 POST 본문에 인자를 싣고 `PostgrestFilterBuilder`를 돌려준다(`PostgrestClient.js:86-119`).
- `order`·`limit`은 쿼리 파라미터로 붙는다(`PostgrestTransformBuilder.js`).
- PostgREST v12는 테이블을 돌려주는 함수의 결과에 필터·정렬·제한을 적용한다([Table-Valued Functions](https://docs.postgrest.org/en/v12/references/api/functions.html#table-valued-functions)).
- 따라서 나중에 멤버 필터를 조합할 때도 `.or(memberFilter(id))`만 붙이면 된다.

### 5.2 마이그레이션 — `search_transactions`

파일: `supabase/migrations/20260927000002_search_transactions.sql` (구현일 기준으로 14자리 타임스탬프를 다시 맞춘다)

```sql
-- BGI-45: 거래 검색. 제목·메모 부분 일치(대소문자 무시). 정렬·개수 제한은 호출하는 쪽이 붙인다.
-- 설계: docs/features/search/design.md
-- ⚠ 반환형이 active_transactions 뷰에 묶여 있다. 뷰를 다시 만드는 마이그레이션은 설계 §8의 순서를 따른다.
-- ⚠ 본문을 BEGIN ATOMIC으로 바꾸지 말 것. select *가 만들 때 고정돼 뷰에 컬럼을 더하면 반환형과 어긋난다.

create function public.search_transactions(
  p_ledger_id uuid,
  p_keyword text
)
returns setof public.active_transactions
language sql
stable
set search_path = public
as $$
  select *
  from public.active_transactions t
  where t.ledger_id = p_ledger_id
    -- 빈 검색어는 strpos가 1을 돌려 전부 걸린다. 클라이언트도 막지만 여기서 한 번 더 막는다.
    and btrim(p_keyword) <> ''
    and (
      strpos(lower(t.title), lower(p_keyword)) > 0
      or strpos(lower(coalesce(t.description, '')), lower(p_keyword)) > 0
    );
$$;

revoke execute on function public.search_transactions(uuid, text) from anon, public;
grant execute on function public.search_transactions(uuid, text) to authenticated, service_role;

comment on function public.search_transactions(uuid, text) is
  '가계부 거래 검색(제목·메모 부분 일치, 대소문자 무시). active_transactions 뷰를 읽는다. RLS 적용(SECURITY INVOKER) — DEFINER로 바꾸지 말 것.';

notify pgrst, 'reload schema';
```

- **`SECURITY INVOKER`(기본값)를 유지한다.**
  - `active_transactions`는 `security_invoker = on` 뷰라 호출자 기준으로 `transactions` RLS가 걸린다. 남의 가계부 id를 넣으면 0건이다.
  - 삭제 거래 제외도 뷰의 `deleted_at is null`이 한다. service_role 경로에서도 걸러지므로 BGI-36 규칙을 충족한다.
- **권한**: 새 함수는 EXECUTE가 기본으로 PUBLIC·anon에 열린다. 둘 다 회수한다(CLAUDE.md, BGI-43과 같은 방식).
- **`set search_path = public`**: advisor 경고(function_search_path_mutable)를 피한다.
  - 이 설정 때문에 SQL 함수 인라이닝이 막혀, 가계부의 검색 결과 전체를 만든 뒤 정렬한다. 가계부 하나가 최대 401건이라 문제없다.
- **NULL은 막힌 쪽으로 떨어진다**: `p_keyword`나 `p_ledger_id`가 NULL이면 0건이다. `title`은 `NOT NULL`이라 `coalesce`는 `description`에만 쓴다.
- **뷰 결합**: `returns setof active_transactions`는 뷰 컬럼을 다시 적지 않아도 되는 대신 뷰 행 타입에 의존한다.
  - 뷰 끝에 컬럼을 더하는 `create or replace view`는 괜찮다. `$$` 문자열 본문은 실행할 때 다시 해석되므로 `select *`가 새 컬럼까지 돌려준다.
  - 뷰를 지우고 다시 만드는 경우는 §8.
- **하위 호환**: 새 함수라 1.5.1 이하 앱과 web에 영향이 없다. DB를 앱보다 먼저 배포한다.
- `database-generated.ts`는 고치지 않는다(core는 제네릭 없는 `SupabaseClient`를 쓴다. BGI-43과 같음).

### 5.3 core

검색은 기존 `TransactionFilter`에 `keyword`를 끼우지 않고 **별도 경로**로 둔다.
- `TransactionFilter`는 `TransactionRepository.findByFilter`(테이블)도 받는다. 거기서 `keyword`를 조용히 무시하면 함정이 된다.
- 검색은 기간 조건이 없어 입력 모양도 다르다.

| 층 | 변경 |
| --- | --- |
| application 입력 타입 | `TransactionSearchInput { ledgerId: string; keyword: string; limit: number }`. `packages/core/src/index.ts`에서 export |
| `TransactionService.searchTransactions(input)` | `getTransactions`와 같은 권한 확인(현재 사용자·가계부 멤버) 후 리포지토리 호출. `TransactionWithDetails[]` 반환 |
| infra `TransactionViewRepository.search(ledgerId, keyword, limit)` | `.rpc('search_transactions', { p_ledger_id, p_keyword })` → `.order('transaction_date', desc)` → `.order('created_at', desc)` → `.limit(limit)` |

- 정렬은 목록(`findWithDetails`)과 같다. 페이징이 없어 동률 기준(`id`)이나 공용 함수는 필요 없다. `findWithDetails`는 건드리지 않는다.
- 검색어 정리(`normalizeKeyword`)는 native에서 한다. 서비스는 받은 그대로 넘기고, 빈 검색어는 RPC가 막는다.
- 권한 확인 블록은 서비스에 이미 다섯 번 있다. 이번에도 같은 방식으로 두고, `assertActiveMember` 추출은 별도 정리로 미룬다.

### 5.4 native 쿼리 — 한 번에 받는다

**이어 받기(`useInfiniteQuery`)를 쓰지 않는 이유**
- **거래 상세 화면이 죽는다.** `useTransactionDetail.ts:106-109`의 `findInTransactionLists`는 `['transactions']` 아래 모든 캐시를 거래 배열로 보고 `.find()`를 부른다.
  - 이어 받기 캐시는 `{ pages, pageParams }` 모양이라 거기서 에러가 난다.
  - 검색 화면을 떠나도 캐시가 5분 남아, 그동안 목록에서 행을 눌러도 죽는다.
- **나눠 받아도 DB 일은 줄지 않는다.** RPC가 인라인되지 않아 페이지마다 가계부의 검색 결과 전체를 만든 뒤 자른다.
- **왕복이 많아진다.**
  - 요청 한 번이 순차 왕복 3번이다(`auth.getUser()` → 멤버 확인 → RPC).
  - 포커스 복귀 때 이어 받기는 받은 페이지 수만큼 순서대로 다시 받는다.
- **선례가 있다.** 거래 목록(`useTransactions`)도 한 달 치를 최대 1000건까지 한 번에 받는다.

**hook `useTransactionSearch(keyword)`** (`hooks/useTransactionSearch.ts`)
- **키**: `queryKeys.transactions.search(ledgerId, keyword)` → `['transactions', 'search', ledgerId, keyword]`.
  - `['transactions', …]` 아래에 둬야 기존 `invalidateTransactionLists`(입력·수정·삭제·카테고리·결제수단·닉네임 변경)가 검색 결과도 stale로 표시한다.
  - 월 목록 키(`['transactions', ledgerId, …]`)와는 두 번째 요소가 달라 겹치지 않는다.
- **데이터**: `TransactionWithDetails[]`. 개수 제한은 `FETCH_LIMIT = 1000`, 개수 세기(`count`)는 쓰지 않는다. 배열 길이가 개수다.
  - 덤으로 상세 화면이 검색 결과에서 같은 거래를 찾아 로딩 없이 열린다(월 목록과 같은 동작).
- `enabled`: 가계부가 있고 검색어가 비지 않았을 때.
- **`placeholderData`**: 글자를 고치는 동안 이전 결과를 유지해 깜빡이지 않게 한다. 단, **같은 가계부일 때만** 유지한다. `useMonthlyData`와 같은 방식이다.
  - `(prev, prevQuery) => prevQuery?.queryKey[2] === ledgerId ? prev : undefined`
  - 초대 링크로 가계부가 바뀐 뒤 이전 가계부 결과가 잠깐 보이지 않게 한다.
- **`loading`·`error`·`refetch`는 `useQueryStatus`로 만든다.**
  - 비활성 쿼리의 `refetch` 차단(`refetch()`는 `enabled`를 무시한다)과 마운트 조회와 합치기를 이미 한다.
- 반환
  - 날짜 그룹 `sections`, `results`(배열), `isPlaceholderData`, `loading`·`error`·`refetch`
  - "표시 중인 결과의 검색어"는 따로 들고 있지 않는다. 결과 없음은 placeholder가 아닐 때만 판단하므로 그때 결과는 늘 현재 검색어의 것이다(§6.5).
- **날짜 그룹**: `useTransactions` 안의 그룹화를 `utils`의 순수 함수(`groupByDate`)로 빼서 둘이 같이 쓴다. 호출하는 쪽은 `useMemo`로 감싼다. 목록 화면의 effect가 참조 안정성에 기댄다.
- **디바운스**: `hooks/useDebouncedValue.ts`를 새로 둔다. 값을 300ms 늦게 따라가고, 바로 반영하는 `flush()`를 함께 돌려준다(검색 키용).
  - **정리된 값을 디바운스한다**: `useDebouncedValue(normalizeKeyword(input), 300)`. 뒤 공백이나 조합 중 자모로 디바운스가 다시 걸리지 않는다.
  - `utils/timing.ts`의 `debounce`는 콜백용이라 입력 상태에는 hook이 더 단순하다.
- **캐시 쌓임**: 검색어마다 키가 생기지만 화면을 떠난 쿼리는 기본 `gcTime`(5분) 뒤 지워진다. 따로 `staleTime`·`gcTime`을 정하지 않는다.
- **포커스 재조회**: 무효화가 `refetchType: 'none'`이라 표시만 한다. 화면에 돌아올 때 `refetch()`한다.
  - `useFocusEffect` 의존성에 `refetch`를 그대로 둔다. 검색어가 처음 생길 때(비활성 → 활성) 정체성이 바뀌어 효과가 다시 돌지만, `useQueryStatus`가 `cancelRefetch: false`로 진행 중인 마운트 조회에 합류시켜 요청이 겹치지 않는다.

## 6. UI

### 6.1 진입 — 홈 헤더 오른쪽 아이콘

```
 ─────────────────────────────────────
  우리집 가계부                    🔍
 ─────────────────────────────────────
   ◀        2026년 9월        ▶
```

- `(tabs)/index.tsx`의 `styles.header`를 가로 배치(`flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`)로 바꾸고 오른쪽에 `Pressable` + `Ionicons "search"`를 둔다.
- 가계부 이름에 `flexShrink: 1`, `numberOfLines={1}`을 준다. 이름이 길어도 아이콘이 밀려나지 않고 이름이 말줄임된다.
- 아이콘
  - `colors.text`, **크기 24 + `hitSlop={10}`**. 터치 영역 44pt(`design-principles.md` 터치 영역)를 채우면서 헤더 높이(28)는 그대로다.
  - 크기는 `ScreenHeader` 뒤로 버튼과 같다.
  - `accessibilityRole="button"`, `accessibilityLabel="거래 검색"`.
- 헤더는 ScrollView 안에 있어서 아이콘도 함께 스크롤된다. 지금 가계부 이름과 같은 동작이라 그대로 둔다.
- 누르면 `router.push('/search')`.

### 6.2 검색 화면 — 헤더에 입력칸

```
 ─────────────────────────────────────
  ‹   ┌ 🔍 제목이나 메모로 검색 ─── ⓧ ┐
 ─────────────────────────────────────


      우리집 가계부의 모든 거래에서 찾아요
```

- 새 스택 화면 `app/search.tsx`. 본문 맨 위에 `ScreenHeader`만 둔다(CLAUDE.md).
- **루트 `_layout.tsx`에 `<Stack.Screen name="search" options={{ keyboardHandlingEnabled: true }} />`를 선언한다.**
  - iOS에서 키보드가 떠 있는 채 뒤로 스와이프하면 키보드를 내린다.
  - 화면 본문에서 `Stack.Screen`을 쓰면 헤더가 번쩍이므로 루트에 둔다(CLAUDE.md).
- `ScreenHeader`의 `center`에 입력칸(`components/search/SearchInput.tsx`)을 넣는다.
  - 기본 배치라 좌·우 슬롯이 각각 최소 44px다. 오른쪽은 비어 있지만 양쪽이 같아 입력칸이 가운데 대칭으로 놓인다.
  - 기본 중앙 슬롯은 `alignItems: 'center'`라 입력칸에 `alignSelf: 'stretch'`를 줘야 폭을 채운다.
- **입력칸 모양**: 배경 `colors.backgroundSecondary`, 높이 36, 둥근 모서리 10. 왼쪽 돋보기 아이콘(`colors.textSecondary`, 장식이라 접근성에서 숨긴다).
- **`TextInput` 속성**

  | 속성 | 값 | 이유 |
  | --- | --- | --- |
  | `style.color` | `colors.text` | 없으면 RN 기본 검정이라 **다크 모드에서 글자가 안 보인다** |
  | `placeholderTextColor` | `colors.textSecondary` | 위와 같음. `add.tsx`와 같은 값 |
  | `selectionColor` | `colors.tint` | 커서·선택 색 |
  | `keyboardAppearance` | 현재 색 모드 | 다크 모드에서 어두운 키보드 |
  | `autoFocus` | true | 푸시 애니메이션과 키보드가 같이 올라온다(토스와 같은 패턴) |
  | `returnKeyType` | `"search"` | |
  | `enablesReturnKeyAutomatically` | true | 빈 칸이면 검색 키를 끈다 |
  | `onSubmitEditing` | 디바운스 `flush()` | 검색 키를 누르면 300ms 기다리지 않고 바로 검색. 한 줄 입력이라 키보드는 내려간다 |
  | `autoCorrect` / `autoCapitalize` | false / `"none"` | 영문 검색어가 바뀌지 않게 |
  | `maxLength` | 50 | |
  | `maxFontSizeMultiplier` | 1.3 | 헤더 높이 44가 고정이라 가장 큰 글자 크기에서 잘린다 |
  | placeholder | "제목이나 메모로 검색" | |
  | `accessibilityLabel` | "거래 검색어" | |

- **ⓧ 지우기 버튼**
  - 글자가 있을 때만 오른쪽에 `close-circle`을 보인다. iOS `clearButtonMode`는 Android에 없어서 직접 그린다.
  - 누르면 비우고 포커스를 유지한다(`inputRef.focus()`).
  - `accessibilityRole="button"`, `accessibilityLabel="검색어 지우기"`, `hitSlop`으로 44pt.
- **안내 문구**(검색어가 비었을 때): **"{가계부 이름}의 모든 거래에서 찾아요"** (`colors.textSecondary`).
  - placeholder와 같은 말을 반복하지 않고 검색 범위를 알려준다. 검색 화면엔 가계부 이름이 따로 보이지 않는다.

### 6.3 결과 목록

```
  12건
 ─────────────────────────────────────
  9월 21일 (일)
  (🍙)  아침 김밥                -4,500
        식비
 ─────────────────────────────────────
  8월 3일 (일)
  (🍙)  편의점                   -6,200
        메모 · …삼각김밥, 우유
 ─────────────────────────────────────
  2025년 12월 30일 (화)
  (🍙)  김밥천국                -12,000
        식비
```

- **`SectionList`**
  - 섹션 = 날짜, 행 = `TransactionItem`.
  - **`stickySectionHeadersEnabled={false}`**. 목록 화면과 같다. iOS 기본값은 sticky이고 섹션 헤더에 배경이 없어 행 위에 겹친다.
- **섹션 헤더**: 목록 화면의 `DateSectionHeader`를 `components/transaction/DateSectionHeader.tsx`로 빼서 같이 쓴다. `withYear` 옵션을 받는다.
  - 올해면 `formatDayKorean`("9월 21일 (일)").
  - 올해가 아니면 `formatDateKorean`("2025년 12월 30일 (화)"). 둘 다 이미 있다.
- **"N건"**(`ListHeaderComponent`, `body2`, `textSecondary`): 결과가 1건 이상이면 그린다. 이전 결과를 보이는 동안에도 이전 개수를 목록과 함께 흐리게 둔다.
  - 숨기면 그 줄 높이만큼 목록이 올라갔다가 새 결과와 함께 내려온다(1.6.0 빌드 27 TestFlight에서 발견한 레이아웃 시프트).
  - 결과가 없으면 "N건" 대신 결과 없음 문구(§6.5)가 나오므로 "0건"과 같이 뜨지 않는다.
- **상한**: 결과가 1,000건이면 목록 끝에 "최근 1,000건까지만 보여요"를 보인다.
  - 정확히 1,000건일 때도 보이지만, 가장 큰 가계부가 401건이라 받아들인다.
- **이전 결과를 유지하는 동안**(`isPlaceholderData`): 목록을 흐리게(opacity 0.5) 해 새 검색어의 결과가 아님을 보인다.
- **검색어가 바뀌면 맨 위로**: 검색어가 바뀌면 목록을 맨 위로 스크롤한다(`getScrollResponder().scrollTo`). 목록을 다시 마운트(`key`)하면 이전 결과로 한 번, 새 결과로 한 번 셀을 두 번 만든다.
- **결과 목록은 `components/search/SearchResults.tsx`의 memo 컴포넌트다.** 입력칸 상태(`input`)와 떼어 두어 글자를 칠 때마다 목록이 다시 그려지지 않는다(React Compiler가 꺼져 있다).
- **키보드**
  - `keyboardShouldPersistTaps="handled"`: 키보드가 떠 있어도 첫 탭에 행이 눌린다.
  - `keyboardDismissMode="on-drag"`: 스크롤하면 키보드가 내려간다.
- **행을 누르면** `Keyboard.dismiss()` 후 목록과 같은 경로로 `/transaction-detail`을 연다. native-stack은 푸시할 때 키보드를 내리지 않는다.
  - 돌아오면 검색 화면이 그대로 마운트돼 있어 검색어·스크롤이 유지된다.
  - 포커스 재조회(§5.4)로 수정·삭제가 반영된다.

### 6.4 메모에서 찾은 결과의 두 번째 줄

`TransactionItem`의 두 번째 줄은 지금 카테고리 이름만 보인다. 메모에서만 걸린 거래는 왜 나왔는지 알 수 없다.

- `TransactionItem`에 `subtitle?: string`을 추가한다. 없으면 지금처럼 `category_name`. 두 번째 줄에 `numberOfLines={1}`을 준다.
- 검색 화면에서 행마다 정한다. 메모 부분은 core 순수 함수 `memoSnippet(description, keyword)`(`domain/transaction/search.ts`)가 만들고, 없으면(제목 일치 또는 둘 다 불일치) `category_name`을 쓴다.
  - 제목에 검색어가 있으면 `category_name`.
  - 제목엔 없고 메모에 있으면 **`메모 · ${snippet}`**. 카테고리는 아이콘과 색이 이미 보여주므로 이 줄에서 뺀다.
  - 둘 다 없으면 `category_name`. 이전 검색어의 결과를 새 검색어로 판정하는 placeholder 중이거나, DB `lower()`와 JS `toLowerCase()`가 다른 드문 문자일 때다.
- **스니펫 규칙**: 두 번째 줄은 폭이 좁다.
  - 375pt 화면에서 아이콘과 금액을 빼면 약 220pt이고, 12px 글자로 한글 18자 정도다. 앞 문맥을 길게 두면 검색어가 잘린다.
  - 일치 위치 **4자 앞**부터 자른다. 그 4자 안에 공백이 있으면 공백 뒤부터 자른다.
  - 앞을 잘랐으면 맨 앞에 `…`를 붙인다.
  - 메모의 줄바꿈은 공백으로 바꾼다.
  - 일치 여부와 위치는 `toLowerCase()`한 문자열로 구한다. 소문자로 바꾸면 길이가 달라지는 드문 문자(İ 등)는 위치가 어긋날 수 있고, 무시한다.

### 6.5 상태별 화면

화면은 아래 순서로 판단한다.

| 순서 | 조건 | 화면 |
| --- | --- | --- |
| 1 | `normalizeKeyword(input) === ''` **또는** 디바운스된 검색어가 빈 값 | 안내 문구(§6.2) |
| 2 | `loading`(받아둔 결과 없이 첫 조회 중) | `LoadingState` "검색 중..." |
| 3 | `error` | `ErrorState` "검색 결과를 불러올 수 없습니다" + 다시 시도 |
| 4 | 결과 0건이고 `isPlaceholderData`가 아님 | **"'{검색어}' 검색 결과가 없어요"** |
| 5 | 그 외 | 결과 목록(placeholder면 흐리게) |

- **1번은 원래 입력과 디바운스값을 둘 다 본다.** 쿼리가 꺼져 있어도 `keepPreviousData`가 이전 결과를 placeholder로 주기 때문이다.
  - 원래 입력만 보면: 비운 뒤 새로 입력하는 300ms 동안 디바운스값이 빈 값이라, 이전 결과가 다시 나타난다.
  - 디바운스값만 보면: ⓧ를 누른 뒤 300ms 동안 이전 결과가 남는다.
- **결과 없음 문구는 조사를 쓰지 않는다.** "'떡볶이'가 / '김밥'이"처럼 받침에 따라 조사가 바뀐다.
  - 검색어는 디바운스된 검색어다. 4번은 placeholder가 아닐 때만이라 결과와 검색어가 늘 짝이 맞는다.
  - 최대 50자라 `textAlign: 'center'`와 좌우 여백을 준다.
- **안내·결과 없음·로딩·에러는 위쪽에 둔다**(`paddingTop` 80 정도, 가운데 정렬하지 않는다).
  - 화면에 들어오면 키보드가 항상 떠 있다.
  - `LoadingState`·`ErrorState`의 기본 가운데 정렬이면 667pt 기기에서 "다시 시도" 버튼이 키보드에 가린다. 스타일을 덮어쓰거나 감싸는 컨테이너로 조정한다.
- 문구 어미는 기존 화면을 따른다.
  - 에러: `ErrorState`의 "~습니다"
  - 빈 상태: 목록의 "~없어요"
  - 진행 중: "~중..."

## 7. 하지 않는 것

- **이어 받기(페이징).** 가계부 하나가 최대 401건이라 한 번에 받는다(§5.4).
  - 다시 볼 기준: 가계부 하나가 1만 건을 넘거나 응답이 체감될 만큼 느려질 때(아래 인덱스와 같다).
  - 도입하면 캐시 모양(§8)부터 본다.
- **텍스트 인덱스(`pg_trgm` GIN).**
  - 기존 부분 인덱스 `idx_transactions_ledger_date (ledger_id, transaction_date desc) where deleted_at is null`이 가계부 하나(최대 401건)로 범위를 줄인다.
  - 정렬은 인라인되지 않는 함수 결과 위에서 따로 한다. 401행이라 문제없다.
  - trigram 인덱스는 `LIKE`/`ILIKE` 같은 연산자에만 쓰인다. **`strpos` 조건에는 설치해도 쓰이지 않는다.** 검색어가 3자 미만이어도 쓰이지 않는다(흔한 "김밥", "밥").
  - 다시 볼 때는 RPC 조건을 `ilike`로 바꾸고, SQL 안에서 `replace()`로 `\` `%` `_`를 이스케이프한다. §5.1의 이스케이프 문제는 URL 필터 문법 쪽이라 SQL 안에서는 간단하다.
- 카테고리명·결제수단명·금액 검색. 카테고리는 필터로 두는 게 맞고, 금액은 입력 규칙("5000" vs "5,000")부터 정해야 한다.
- 최근 검색어(저장 위치·삭제 UI까지 범위가 커진다).
- 일치 부분 강조 표시, 결과 개수 음성 안내(VoiceOver announce).
- 멤버·카테고리·기간 필터와 조합. 멤버는 `search`에 `.or(memberFilter(id))`를 붙이면 된다(§5.1).
- 단어별 AND 검색, 유니코드 정규화.
- 초성 검색(`ㄱㅂ` → 김밥). BGI-54에서 따로 기획한다.
- web. web은 거래 목록 조회 경로를 쓰지 않는다(`apps/web/lib/services.ts`).
- 행동 분석 이벤트. native에 수집 SDK가 없다.

## 8. 함정

- **`['transactions']` 아래 캐시는 거래 배열로 둔다.**
  - `useTransactionDetail`의 `findInTransactionLists`가 그 아래 캐시에서 같은 거래를 찾아 상세를 로딩 없이 연다.
  - 구현 때 배열이 아닌 캐시는 건너뛰는 가드를 넣어 다른 모양(`InfiniteData` 등)이 와도 죽지는 않는다. 다만 그 캐시의 거래는 즉시 열리지 않는다.
- **`active_transactions`를 다시 만드는 마이그레이션은 이 순서를 지킨다.** `20260308000002`처럼 `DROP VIEW ... CASCADE` → `CREATE VIEW`만 하면 두 가지가 한꺼번에 깨진다.
  - `search_transactions`가 에러 없이 지워진다. 앱은 검색에서 404(PGRST202)를 받는다.
  - `20260830000013`이 기본 권한을 회수해 새 뷰에 `authenticated` SELECT가 없다. **기존 거래 목록도 42501**이 되고, INVOKER인 검색도 막힌다.
  1. `drop function public.search_transactions(uuid, text);`로 먼저 명시적으로 지운다.
  2. `drop view public.active_transactions;` — **CASCADE 없이.** 빠뜨린 의존 객체가 있으면 조용히 지워지지 않고 실패한다.
  3. 뷰를 만들고 `alter view ... set (security_invoker = on)`.
  4. `grant select on public.active_transactions to authenticated, service_role;`
  5. 함수를 다시 만들고 revoke/grant를 다시 건다(§5.2).
- **빈 검색어는 전부 걸린다**(`strpos(x, '') = 1`). 클라이언트 `normalizeKeyword` + RPC `btrim(...) <> ''` 두 겹으로 막는다.
  - `btrim`은 공백(U+0020)만 자르지만 클라이언트가 먼저 탭·줄바꿈까지 자르므로 충분하다.
- 검색 결과와 캘린더 합계는 기준이 다르다. 검색은 뷰를 읽어 삭제된 카테고리의 거래가 빠진다. 이 둘을 비교하지 않는다.

## 9. 작업 목록

1. 마이그레이션 `search_transactions` (§5.2). 로컬에서 먼저 확인한다.
   - `.rpc(...).order(...).limit(...)`가 정렬·제한된 결과를 돌려주는지
   - anon 호출 42501, 빈 검색어·공백 검색어 0건, 남의 가계부 id 0건
2. core: `TransactionSearchInput`(export 포함), `TransactionService.searchTransactions`, `TransactionViewRepository.search`, `normalizeKeyword`·`memoSnippet` + vitest
3. native 기반
   - `queryKeys.transactions.search`
   - `groupByDate` 추출(`useTransactions`가 같이 쓴다)
   - `useDebouncedValue`, `useTransactionSearch`
4. native UI
   - 홈 헤더 아이콘, 루트 `_layout.tsx`의 `search` 화면 옵션
   - `app/search.tsx`, `SearchInput`, `DateSectionHeader` 추출
   - `TransactionItem`의 `subtitle`
5. 검증(§10), 라이트·다크
6. 프로덕션 DB 반영(`db push --dry-run` → `db push`) → 다음 앱 출시에 포함 (BGI-43과 같은 버전)

## 10. 검증

**검색 규칙**
- 한글 부분 일치: "김밥" → "아침 김밥", "삼각김밥"
- 영문 대소문자: "star" → "Starbucks"
- 1자 검색어("밥")가 동작한다
- 공백만, 자모만("ㅋㅋ") 입력 → 안내 화면, 요청이 나가지 않는다
- 특수문자 `%` `_` `*` `,` `(` `)` `"` `\` 각각: 에러 없이 글자 그대로 일치하는 것만(없으면 결과 없음)

**메모 스니펫**
- 메모에서만 일치 → 두 번째 줄이 `메모 · …스니펫`이고 검색어가 보인다
- 375pt 폭, 7자리 금액(-1,250,000원), 200자 메모의 끝부분 일치에서도 검색어가 잘리지 않는다

**범위**
- 삭제된 거래가 나오지 않는다
- 다른 가계부의 거래가 나오지 않는다
- anon으로 RPC 호출 → 42501
- 2025년 거래가 연도와 함께 나온다

**캐시·이동**
- **결과 → 상세가 로딩 없이 열린다. 검색 후 목록 화면에서 캐시 없는 달의 행을 눌러도 상세가 열린다**(§8 회귀)
- 결과 → 상세에서 제목 수정 → 돌아오면 바뀐 제목
- 상세에서 삭제 → 돌아오면 행이 없다
- 검색어를 고치는 동안 결과가 비었다 다시 나타나지 않고, 흐리게 유지된다
- 새 검색어가 결과 없음일 때 이전 검색어로 "결과 없음"이 번쩍이지 않는다
- ⓧ로 비우면 바로 안내 화면. 비운 뒤 새로 입력하는 동안 이전 결과가 다시 나타나지 않는다
- 새 검색어의 결과가 오면 스크롤이 맨 위

**입력·키보드**
- 한글을 빠르게 입력해도 자모가 갈라지지 않는다. 갈라지면 제어형 `value` 대신 `defaultValue` + `onChangeText` + ⓧ에서 `ref.clear()`로 바꾼다
- 낱자로 끝난 채("김ㅂ") 멈추면 "김"의 결과가 보인다
- 검색 키를 누르면 바로 검색되고 키보드가 내려간다
- 화면이 열리는 애니메이션 중 키보드가 버벅이지 않는다. 버벅이면 전환이 끝난 뒤 포커스한다(키보드가 약 350ms 늦게 뜬다)
- 키보드가 떠 있는 채 행을 한 번에 누를 수 있고, 상세 화면에 키보드가 없다
- 키보드가 떠 있는 채 뒤로 스와이프하면 키보드가 내려간다
- 스크롤하면 키보드가 내려간다
- 667pt 기기에서 키보드가 떠 있을 때 에러 화면의 "다시 시도"를 누를 수 있다

**UI**
- 다크 모드에서 입력 글자·placeholder·커서·키보드가 보인다
- 가장 큰 글자 크기에서 헤더 입력칸이 잘리지 않는다
- 결과 없음일 때 "0건"이 같이 뜨지 않는다
- 홈 아이콘 탭 영역(44pt), 긴 가계부 이름에서 아이콘이 밀려나지 않는다
- 검색 화면 오른쪽 빈 여백이 어색하지 않다. 어색하면 `ScreenHeader`에 옵션을 추가한다
- VoiceOver로 홈 🔍("거래 검색")와 ⓧ("검색어 지우기")를 읽는다
