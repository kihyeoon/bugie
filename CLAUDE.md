# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 지침이다.

## 프로젝트 개요

**Bugie** — 부부/가족용 공유 가계부 앱. pnpm + Turborepo 모노레포로 웹(Next.js)과 네이티브(Expo)를 동시 지원한다.

## Critical Gotchas

코드/`tsconfig`만 봐서는 알 수 없는, 실수했을 때 비용이 큰 항목들이다.

- **날짜 직렬화**는 반드시 `@repo/core`의 `formatLocalDate` / `parseLocalDate`를 사용한다. `Date.toISOString().split('T')[0]` 또는 `new Date('YYYY-MM-DD')`를 그대로 쓰면 KST에서 월 경계 날짜가 하루 밀린다 (v1.2.1 hotfix 사유).
- **`@repo/ui`만 빌드가 필요하다.** `@repo/core`/`@repo/types`는 `main: "./src/index.ts"`로 소스 직접 참조. UI 패키지 수정 후엔 `pnpm --filter @repo/ui build` 필수. `@repo/ui`의 `react`/`react-native`는 **`peerDependencies`로 둔다** — `dependencies`로 옮기면 중복 네이티브 모듈이 설치돼 `expo-doctor`가 막는다. (현재 native는 `@repo/ui`를 import하지 않아 의존성에서 빠져 있다.)
- **새 Supabase 테이블엔 RLS 정책 + Data API GRANT를 반드시 추가한다.** RLS 누락 = 전 사용자 데이터 노출. GRANT 누락 = 2026-10-30부터 SDK에서 `42501 permission denied`(자동 GRANT 정책 종료). 템플릿은 아래 [Supabase 마이그레이션 표준 템플릿](#supabase-마이그레이션-표준-템플릿) 참조.
- **삭제는 soft delete 패턴**(`deleted_at` 컬럼). RLS를 우회해야 하므로 `SECURITY DEFINER` RPC 함수로 처리. 회원 탈퇴는 30일 유예 후 GitHub Actions cron(`process-account-deletions.yml`)으로 완전 삭제.
- **터치 인터랙션은 `Pressable`을 사용한다.** `TouchableOpacity` 신규 사용 금지 (기존 132군데 일괄 전환 예정).
- **네이티브 스택 화면 헤더는 공유 `ScreenHeader`(`components/shared/ScreenHeader.tsx`)를 쓴다.** `Stack.Screen`의 네이티브 헤더(`headerLeft`/`title` 등)를 쓰면 iOS 26에서 백 버튼에 Liquid Glass 캡슐이 강제 적용된다. `headerShown: false`는 루트 `app/_layout.tsx`의 `<Stack screenOptions={{ headerShown: false }}>`가 전역 적용하므로, **새 스택 화면은 본문 최상단에 `ScreenHeader`만 렌더하면 된다.**
- **화면 본문 안에서 `<Stack.Screen options={{ headerShown: false }} />`를 쓰지 않는다.** expo-router의 `Screen`은 `useLayoutEffect`에서 `navigation.setOptions()`를 호출해 항상 한 커밋 늦게 적용된다. 그 사이 첫 커밋은 `options = {}`로 렌더되어 native-stack 기본값(헤더 표시 + title = 라우트 파일명)이 적용되고, 실제 `UINavigationBar`가 한 프레임 생겼다가 0.25초 애니메이션으로 사라진다 → 헤더 플래시 + 콘텐츠 세로 점프. 화면별 옵션이 필요하면 **루트 레이아웃의 `<Stack.Screen name="..." options={...} />`에 선언한다** (`+not-found`가 그 예).
- **`@react-navigation/*`를 직접 import하지 않는다.** SDK 56부터 expo-router가 React Navigation 의존을 끊었다. 테마·`useFocusEffect`·`PlatformPressable`은 `expo-router/react-navigation`에서, `BottomTabBarButtonProps`·`useBottomTabBarHeight`는 `expo-router/js-tabs`에서 가져온다. 패키지 자체는 제거된 상태라 추가하면 expo-router 내장본과 중복된다.
- **reanimated는 4.x다.** JS 콜백은 `runOnJS(fn)(arg)`가 아니라 `react-native-worklets`의 `scheduleOnRN(fn, arg)`를 쓴다(인자를 직접 넘김). 타입은 `AnimatedStyleProp` 대신 `AnimatedStyle`.
- **`useColorScheme()`은 `'light' | 'dark'`만 반환한다** (`hooks/useColorScheme.ts`에서 좁힘). RN 0.86의 `ColorSchemeName`에는 `'unspecified'`가 있어서 그대로 `Colors[...]`에 넣으면 타입 에러가 난다. RN의 `useColorScheme`을 직접 import하지 말 것.
- **`StyleSheet.absoluteFillObject`는 RN 0.86에서 타입이 없어졌다.** `StyleSheet.absoluteFill`을 쓴다(동일한 평범한 객체라 spread 동작 같음).
- **색상은 `constants/Colors.ts`의 시맨틱 컬러만 사용한다.** Toss 디자인 시스템 기반. 하드코딩된 hex 금지.
- **Supabase 실시간 구독**은 `useEffect` cleanup에서 반드시 해제한다.
- **마이그레이션 파일명**은 `YYYYMMDDHHMMSS_name.sql` (14자리 타임스탬프 필수).

## Supabase 마이그레이션 표준 템플릿

`public` 스키마에 새 테이블을 만들 때 다음 블록을 반드시 포함시킨다. RLS와 GRANT는 별도 관문이므로 둘 다 필요하다 (GRANT = 테이블 자체 접근, RLS = 행 단위 필터).

```sql
create table public.xxx ( ... );

-- 1) Data API GRANT (2026-10-30 이후 자동 부여 종료)
grant select, insert, update, delete on public.xxx to authenticated;
grant select, insert, update, delete on public.xxx to service_role;
-- 비로그인 접근이 필요할 때만 anon 추가 (Bugie는 보통 불필요)

-- 2) RLS 활성화
alter table public.xxx enable row level security;

-- 3) 정책 추가
create policy "xxx_select_policy" on public.xxx
  for select to authenticated
  using ( ... );
```

GRANT가 빠지면 PostgREST가 `42501 permission denied`를 반환한다(RLS가 완벽해도 그 앞에서 막힘). 기존 테이블은 자동 부여된 GRANT가 유지되므로 영향 없다.

## 환경변수

Web과 Native에서 접두사가 다르다.

| 용도 | Web (Next.js) | Native (Expo) |
|------|--------------|---------------|
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| Supabase Anon Key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Service Role Key | `SUPABASE_SERVICE_ROLE_KEY` | — |

## 의존성 설치 규칙

- 웹 전용 → `pnpm add <pkg> --filter web`
- 네이티브 전용 → `pnpm add <pkg> --filter native`
- 공통 dev 도구 → `pnpm add <pkg> -w` (루트)
- `@repo/core`에 새 의존성 추가 시 web/native 양쪽에서 호환되는지 확인

## 주요 명령어

```bash
# 개발
pnpm dev                              # 전체 앱 동시 실행 (turbo)
pnpm --filter native start            # Expo dev server만 (Metro, JS 개발 — 일상 작업은 이걸 사용)
pnpm --filter web dev                 # Next.js만 (localhost:3000)
pnpm --filter native ios              # 네이티브 빌드 + 설치 (expo run:ios — 네이티브 변경 시에만)

# 빌드
pnpm build                            # 전체 빌드 (의존성 순서 자동)
pnpm --filter @repo/ui build          # UI 패키지 빌드 (tsup)

# 검사
pnpm lint                             # 전체 lint
pnpm --filter @repo/core lint         # core lint + tsc --noEmit
pnpm format                           # prettier 포맷팅
pnpm check                            # lint + format --check
```

## Verification — 마무리 전 체크리스트

코드 수정 후 다음을 통과시킨다.

```bash
pnpm --filter @repo/core lint                  # core 변경 시
cd apps/native && npx tsc --noEmit             # native 타입체크
pnpm --filter web build                        # web 변경 시
```

UI 변경은 dev 서버를 띄워 브라우저/시뮬레이터에서 직접 확인. 타입체크 통과 ≠ 동작 정상.

## 아키텍처 상세

@docs/architecture.md — 모노레포 구조, `@repo/core` 클린 아키텍처 3계층, native 앱 Provider 체인 / 라우팅 / hook & 컨텍스트 / 컴포넌트 계층, TypeScript 설정.

## 관련 문서

- `docs/spec-workflow.md` — 스펙 기반 개발 워크플로우 ('스펙 기반으로 개발' 요청 시)
- `docs/prd.md` — 제품 요구사항
- `docs/mvp-plan.md` — MVP 계획 / 진행 상황
- `docs/screen-design.md` — 화면별 설계
- `docs/design-principles.md` — 색상·타이포·간격 체계
- `docs/release-notes/` — 버전별 릴리즈 노트
