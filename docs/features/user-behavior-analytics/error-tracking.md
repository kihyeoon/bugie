# 에러 수집 구현 계획 (Sentry)

## 1. 도구 선정: Sentry + PostHog 병행

에러 수집은 행동 분석과 목적이 다르므로 전문 도구를 병행한다.

| 항목 | **Sentry** (에러 전문) | **PostHog** (에러 보조) |
|------|----------------------|----------------------|
| **역할** | 크래시·예외 수집, 스택 트레이스, 성능 모니터링 | 에러 발생 전후 사용자 행동 맥락 |
| **무료 한도** | 월 5,000 에러 + 10,000 성능 단위 | 월 100,000 에러 |
| **네이티브 크래시** | O (symbolication 지원) | X |
| **소스맵 업로드** | O (EAS Build/Update 자동) | X |
| **성능 모니터링** | O (트랜잭션 추적, 스팬 분석) | 제한적 |
| **세션 리플레이 연동** | X | O (에러 발생 시점의 세션 재생) |
| **Expo 지원** | O (`@sentry/react-native` 공식 지원) | O |
| **비용 (확장 시)** | Team $26/월 (50K 에러) | 이미 분석 도구로 포함 |

**전략:**
- **Sentry** → 기술적 에러 수집·디버깅·성능 모니터링 (개발팀용)
- **PostHog** → 에러 발생 시 사용자 맥락 파악 (세션 리플레이 연동, 제품팀용)

---

## 2. 수집 대상 에러 분류

### Tier 1: 크리티컬 (즉시 대응)

| 에러 유형 | 설명 | 수집 방식 |
|----------|------|----------|
| **앱 크래시** | 네이티브 크래시, JS Fatal Error | Sentry 자동 수집 |
| **인증 실패** | OAuth 토큰 만료/갱신 실패, 세션 유실 | Sentry `captureException` |
| **데이터 손실** | 거래 저장 실패, DB 쓰기 오류 | Sentry `captureException` + PostHog 이벤트 |
| **API 5xx** | Supabase 서버 에러 | Sentry HTTP 인터셉터 |

### Tier 2: 메이저 (24시간 내 대응)

| 에러 유형 | 설명 | 수집 방식 |
|----------|------|----------|
| **렌더링 에러** | React 컴포넌트 렌더 실패 | Sentry ErrorBoundary |
| **API 4xx** | 권한 오류, 잘못된 요청 | Sentry breadcrumb |
| **네트워크 타임아웃** | API 응답 지연 (>5초) | Sentry 성능 모니터링 |
| **실시간 동기화 실패** | Supabase Realtime 연결 끊김 | Sentry `captureMessage` |

### Tier 3: 마이너 (주간 리뷰)

| 에러 유형 | 설명 | 수집 방식 |
|----------|------|----------|
| **입력 검증 실패** | 금액 0원, 필수 필드 미입력 반복 | PostHog 커스텀 이벤트 |
| **UI 비정상 상태** | 빈 목록, 로딩 무한 대기 | PostHog 세션 리플레이 |
| **기능 미지원** | 구버전 OS/기기 호환 이슈 | Sentry 태그 분석 |

---

## 3. 구현 가이드

### SDK 설치

```bash
# Sentry Wizard로 자동 설치 (추천)
npx @sentry/wizard@latest -i reactNative

# 수동 설치 시
npx expo install @sentry/react-native
```

Wizard가 자동으로 처리하는 항목:
- `@sentry/react-native` 패키지 설치
- `metro.config.js`에 `@sentry/react-native/metro` 추가
- `app.json`에 `@sentry/react-native/expo` 플러그인 추가
- Android/iOS 소스맵 업로드 설정

### app.json 플러그인 설정

```json
{
  "expo": {
    "plugins": [
      "@sentry/react-native/expo",
      ["expo-router", {}],
      ...
    ]
  }
}
```

### 초기화 설정

```typescript
// app/_layout.tsx — 최상단에서 초기화
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__, // 개발 환경에서는 비활성화
  tracesSampleRate: 0.2, // 성능 트랜잭션 20% 샘플링
  profilesSampleRate: 0.1, // 프로파일 10% 샘플링

  beforeSend(event) {
    // PII 필터링
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    // 민감한 URL 파라미터 제거
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.url) {
      const url = new URL(breadcrumb.data.url);
      url.searchParams.delete('apikey');
      breadcrumb.data.url = url.toString();
    }
    return breadcrumb;
  },
});
```

### Provider 체인 통합

```typescript
// app/_layout.tsx
import * as Sentry from '@sentry/react-native';
import { PostHogProvider } from 'posthog-react-native';

export default Sentry.wrap(function RootLayout() {
  return (
    <PostHogProvider apiKey={POSTHOG_API_KEY} options={{ host: POSTHOG_HOST }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <ServiceProvider>
            <LedgerProvider>
              <ThemeProvider>
                <Stack>...</Stack>
              </ThemeProvider>
            </LedgerProvider>
          </ServiceProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </PostHogProvider>
  );
});
```

### Expo Router 네비게이션 추적

```typescript
// app/_layout.tsx
import { useNavigationContainerRef } from 'expo-router';

const navigationRef = useNavigationContainerRef();

useEffect(() => {
  if (navigationRef) {
    const integration = Sentry.reactNavigationIntegration({
      routeChangeTimeoutMs: 1000,
    });
    integration.registerNavigationContainer(navigationRef);
  }
}, [navigationRef]);
```

### ErrorBoundary 설정

```typescript
// components/shared/AppErrorBoundary.tsx
import * as Sentry from '@sentry/react-native';
import { View, Text, Pressable } from 'react-native';

interface FallbackProps {
  error: Error;
  resetError: () => void;
}

function ErrorFallback({ error, resetError }: FallbackProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
        문제가 발생했습니다
      </Text>
      <Text style={{ fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' }}>
        앱에서 예기치 않은 오류가 발생했습니다.{'\n'}다시 시도해 주세요.
      </Text>
      <Pressable
        onPress={resetError}
        style={{ backgroundColor: '#3182F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
      >
        <Text style={{ color: '#fff', fontSize: 16 }}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

// 사용: 주요 화면별로 래핑
export function withErrorBoundary(
  Component: React.ComponentType,
  componentName: string,
) {
  return function WrappedComponent(props: any) {
    return (
      <Sentry.ErrorBoundary
        fallback={ErrorFallback}
        beforeCapture={(scope) => {
          scope.setTag('boundary', componentName);
        }}
      >
        <Component {...props} />
      </Sentry.ErrorBoundary>
    );
  };
}
```

### 커스텀 에러 수집 유틸

```typescript
// utils/errorTracking.ts
import * as Sentry from '@sentry/react-native';

// 사용자 컨텍스트 설정 (로그인 시)
export function setErrorTrackingUser(userId: string, ledgerId?: string) {
  Sentry.setUser({ id: userId });
  if (ledgerId) {
    Sentry.setTag('ledger_id', ledgerId);
  }
}

// 사용자 컨텍스트 제거 (로그아웃 시)
export function clearErrorTrackingUser() {
  Sentry.setUser(null);
}

// API 에러 수집
export function captureApiError(
  error: unknown,
  context: {
    operation: string; // 예: 'createTransaction', 'fetchLedger'
    table?: string;
    params?: Record<string, unknown>;
  },
) {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'api');
    scope.setTag('operation', context.operation);
    if (context.table) scope.setTag('table', context.table);
    scope.setContext('request', context.params ?? {});
    Sentry.captureException(error);
  });
}

// 비즈니스 로직 에러 (예: 권한 부족, 데이터 정합성 문제)
export function captureBusinessError(
  message: string,
  context: Record<string, unknown>,
) {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'business');
    scope.setLevel('warning');
    scope.setContext('details', context);
    Sentry.captureMessage(message);
  });
}

// 성능 측정 (긴 작업 추적)
export function measurePerformance(name: string) {
  return Sentry.startSpan({ name, op: 'function' }, (span) => span);
}
```

### Supabase 클라이언트 에러 인터셉터

```typescript
// infrastructure/supabase/errorInterceptor.ts
import * as Sentry from '@sentry/react-native';

// Supabase 쿼리 래퍼 — 기존 서비스 레이어에 적용
export function withErrorTracking<T>(
  operation: string,
  fn: () => Promise<{ data: T | null; error: any }>,
): Promise<{ data: T | null; error: any }> {
  return fn().then((result) => {
    if (result.error) {
      Sentry.addBreadcrumb({
        category: 'supabase',
        message: `${operation} failed`,
        level: 'error',
        data: {
          code: result.error.code,
          message: result.error.message,
        },
      });

      // 5xx 에러는 즉시 보고
      if (result.error.code?.startsWith('5') || result.error.code === 'PGRST') {
        captureApiError(new Error(result.error.message), { operation });
      }
    }
    return result;
  });
}
```

---

## 4. 알림 체계

### Sentry 알림 규칙

| 조건 | 알림 채널 | 대상 |
|------|----------|------|
| 새로운 이슈 (첫 발생) | Slack / 이메일 | 개발팀 |
| 에러 급증 (10분 내 10회+) | Slack 긴급 | 개발팀 |
| 크래시율 > 1% | Slack 긴급 | 개발팀 |
| P95 응답시간 > 3초 | Slack | 개발팀 |
| 회귀 이슈 (해결 후 재발) | Slack | 담당 개발자 |

### 대시보드 구성

| 대시보드 | 포함 항목 | 확인 주기 |
|----------|----------|----------|
| **크래시 현황** | 크래시 프리율, 영향 유저 수, 기기/OS 분포 | 일일 |
| **에러 트렌드** | 에러 발생 추이, TOP 10 이슈, 해결률 | 주간 |
| **성능 모니터링** | 화면 로드 시간, API 응답 시간, 느린 트랜잭션 | 주간 |

---

## 5. 구현 로드맵

### Phase 1: Sentry 기초 설정 (1일)

- [ ] Sentry 프로젝트 생성 (React Native)
- [ ] `npx @sentry/wizard` 실행 — 자동 설치 + 설정
- [ ] 환경변수 추가 (`EXPO_PUBLIC_SENTRY_DSN`)
- [ ] EAS Build에 `SENTRY_AUTH_TOKEN` 시크릿 등록
- [ ] `Sentry.init` 설정 (_layout.tsx)
- [ ] `Sentry.wrap(RootLayout)` 적용
- [ ] 테스트 에러 발생 → Sentry 대시보드 수신 확인

### Phase 2: 에러 경계 + 컨텍스트 (1일)

- [ ] `AppErrorBoundary` 컴포넌트 생성
- [ ] 주요 화면에 ErrorBoundary 적용 (홈, 입력, 거래목록, 설정)
- [ ] `errorTracking.ts` 유틸 생성
- [ ] AuthContext에 `setErrorTrackingUser` / `clearErrorTrackingUser` 연동
- [ ] LedgerContext에 `ledger_id` 태그 설정 연동

### Phase 3: 서비스 레이어 에러 추적 (1~2일)

- [ ] Supabase 에러 인터셉터 적용 (TransactionService, LedgerService 등)
- [ ] API 에러에 breadcrumb 자동 추가
- [ ] 네트워크 타임아웃 감지 + 보고
- [ ] Expo Router 네비게이션 추적 설정

### Phase 4: 알림 + 대시보드 (반나절)

- [ ] Sentry 알림 규칙 설정 (Slack/이메일)
- [ ] 크래시 현황 대시보드 구성
- [ ] 에러 트렌드 대시보드 구성
- [ ] 크래시 프리율 목표 설정 (≥ 99.5%)

### Phase 5: 성능 모니터링 (지속)

- [ ] 주요 화면 로드 시간 측정
- [ ] API 응답 시간 추적
- [ ] 느린 트랜잭션 식별 + 최적화
- [ ] 릴리스별 성능 회귀 감지

---

## 6. 성능 목표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 크래시 프리율 | ≥ 99.5% | Sentry Crash Free Sessions |
| API 에러율 | < 0.1% | Sentry 커스텀 대시보드 |
| 평균 응답 시간 | < 300ms | Sentry Performance |
| P95 응답 시간 | < 1.5초 | Sentry Performance |
| 에러 평균 해결 시간 | < 48시간 | Sentry Issue 트래커 |
| 미해결 이슈 수 | < 20개 | Sentry 주간 리뷰 |

---

## 7. 프라이버시

### Sentry PII 필터링

```typescript
// Sentry.init의 beforeSend에서 자동 처리
beforeSend(event) {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }
  return event;
}
```

### opt-out 지원

```typescript
Sentry.getClient()?.getOptions().enabled = false;  // 수집 중지
Sentry.getClient()?.getOptions().enabled = true;   // 수집 재개
```

---

## 8. 참고 자료

- [Sentry React Native 공식 문서](https://docs.sentry.io/platforms/react-native/)
- [Expo + Sentry 통합 가이드](https://docs.expo.dev/guides/using-sentry/)
- [Sentry Expo Router 네비게이션 추적](https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/)
- [Sentry ErrorBoundary](https://docs.sentry.io/platforms/react-native/integrations/error-boundary/)
- [Sentry Breadcrumbs](https://docs.sentry.io/platforms/react-native/enriching-events/breadcrumbs/)
- [Sentry 가격 정책](https://sentry.io/pricing/)
- [PostHog vs Sentry 비교](https://posthog.com/blog/posthog-vs-sentry)
