# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 지침이다.

## 프로젝트 개요

**Bugie** — 부부/가족용 공유 가계부 앱. pnpm + Turborepo 모노레포로 웹(Next.js)과 네이티브(Expo)를 동시 지원한다.

## Critical Gotchas

코드/`tsconfig`만 봐서는 알 수 없는, 실수했을 때 비용이 큰 항목들이다.

- **날짜 직렬화**는 반드시 `@repo/core`의 `formatLocalDate` / `parseLocalDate`를 사용한다. `Date.toISOString().split('T')[0]` 또는 `new Date('YYYY-MM-DD')`를 그대로 쓰면 KST에서 월 경계 날짜가 하루 밀린다 (v1.2.1 hotfix 사유).
- **`@repo/ui`만 빌드가 필요하다.** `@repo/core`/`@repo/types`는 `main: "./src/index.ts"`로 소스 직접 참조. UI 패키지 수정 후엔 `pnpm --filter @repo/ui build` 필수.
- **새 Supabase 테이블엔 RLS(Row Level Security) 정책을 반드시 추가한다.** RLS 누락 = 전 사용자 데이터 노출.
- **삭제는 soft delete 패턴**(`deleted_at` 컬럼). RLS를 우회해야 하므로 `SECURITY DEFINER` RPC 함수로 처리. 회원 탈퇴는 30일 유예 후 GitHub Actions cron(`process-account-deletions.yml`)으로 완전 삭제.
- **터치 인터랙션은 `Pressable`을 사용한다.** `TouchableOpacity` 신규 사용 금지 (기존 132군데 일괄 전환 예정).
- **색상은 `constants/Colors.ts`의 시맨틱 컬러만 사용한다.** Toss 디자인 시스템 기반. 하드코딩된 hex 금지.
- **Supabase 실시간 구독**은 `useEffect` cleanup에서 반드시 해제한다.
- **마이그레이션 파일명**은 `YYYYMMDDHHMMSS_name.sql` (14자리 타임스탬프 필수).

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
pnpm --filter native start            # Expo만 (localhost:8081)
pnpm --filter web dev                 # Next.js만 (localhost:3000)
pnpm ios                              # iOS 시뮬레이터

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
