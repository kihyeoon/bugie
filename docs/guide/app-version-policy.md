# 새 버전 안내 운영 (BGI-52)

앱은 켤 때와 백그라운드에서 돌아올 때 `public.app_versions`의 자기 플랫폼 행을 읽는다.
**1.5.1부터 들어간 기능이라 그 이전 버전 앱에는 효과가 없다.**

| 컬럼 | 비어 있으면(`null`) | 값이 있으면 |
|---|---|---|
| `recommended_version` | 아무것도 안 띄움 (기본) | 현재 버전이 이보다 낮으면 홈에서 Alert를 **버전당 한 번** 띄움 |
| `recommended_message` | 기본 문구: "새로운 기능이 추가됐어요. 지금 업데이트해 보세요." | Alert 본문 |
| `min_supported_version` | 막지 않음 (기본) | 현재 버전이 이보다 낮으면 전체 화면으로 막고 App Store로만 보냄 |

- 값은 **Studio Table Editor나 SQL로 직접 고친다.** 운영 데이터라 마이그레이션이 필요 없다(테이블 구조를 바꿀 때만 마이그레이션).
- 버전 형식은 `MAJOR.MINOR.PATCH`만 받는다. `'1.6'`이나 앞뒤 공백은 check 제약이 거부한다.
- 값을 읽지 못하면(네트워크 오류, 행 없음) 앱은 그냥 통과한다.

## 언제 쓰나

**기능을 알리고 싶을 때** — App Store에 **게시된 것을 확인한 뒤** 넣는다. 심사 중에 넣으면 사용자가 스토어에 가도 새 버전이 없다.

```sql
update public.app_versions
set recommended_version = '1.6.0',
    recommended_message = '거래 검색이 추가됐어요. 지금 업데이트해 보세요.'
where platform = 'ios';
```

같은 버전에는 한 번만 뜨므로 문구만 바꿔서는 다시 띄울 수 없다. 알림을 끄려면 `null`로 되돌린다.

**구버전을 끊어야 할 때** (호환 깨지는 DB 변경 등) — **심사 중인 버전보다 높게 두지 않는다.** 심사관 앱이 막히면 리젝된다.

```sql
update public.app_versions
set min_supported_version = '1.6.0'
where platform = 'ios';
```

## 동작 위치

- 판정 규칙: `packages/core/src/domain/app-version/rules.ts` (테스트 `pnpm --filter @repo/core test`)
- 강제 게이트: `apps/native/components/shared/ForceUpdateGate.tsx` — 루트 레이아웃에 있어 로그인 전·딥링크 진입에서도 막는다
- 권장 Alert: `apps/native/hooks/useRecommendedUpdateAlert.ts` — 홈이 준비된 뒤, 로그인 사용자에게만
