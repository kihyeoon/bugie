# 행동 분석 구현 계획 (PostHog)

## 1. 개요

### 목적

Bugie 앱의 사용자 행동 데이터를 수집·분석하여 제품 개선 의사결정에 활용한다.

### 핵심 목표

- 사용자 여정(가입 → 활성화 → 리텐션) 전 구간의 전환율 측정
- 핵심 기능(거래 입력, 가계부 공유)의 실제 사용 패턴 파악
- 이탈 지점 식별 및 UX 개선 근거 확보
- PRD 성공 지표(DAU 5,000, WAU/MAU ≥ 40%, D30 리텐션 ≥ 25%) 추적

---

## 2. 도구 비교 및 선정

### 후보 도구 비교표

| 항목 | **PostHog** | **Mixpanel** | **Amplitude** | **Firebase Analytics** |
|------|-------------|-------------|---------------|----------------------|
| **무료 한도** | 월 100만 이벤트 + 5,000 세션 리플레이 | 월 100만 이벤트 | 월 1만 MTU (Starter) | 무제한 (500개 이벤트 타입) |
| **Expo 호환** | Expo Go 지원 (네이티브 코드 불필요) | 네이티브 코드 필요 (dev-client) | 네이티브 코드 필요 (dev-client) | 네이티브 코드 필요 (dev-client) |
| **세션 리플레이** | 무료 5,000건/월 | 유료 (Growth 이상) | 미지원 | 미지원 |
| **퍼널 분석** | O | O | O | 제한적 |
| **코호트 분석** | O | O (무료 2개 제한) | O | 제한적 |
| **Feature Flag** | O (무료 100만 요청/월) | X | X (별도 제품) | O (Remote Config) |
| **A/B 테스트** | O (무료) | 유료 | 유료 | O (무료) |
| **오픈소스** | O (셀프호스팅 가능) | X | X | X |
| **설치 난이도** | 낮음 (Provider 래핑) | 중간 | 중간 | 높음 (google-services 설정) |
| **초과 과금** | $0.00031/이벤트 | $0.00028/이벤트 | 커스텀 | 무료 |
| **데이터 보존** | 무료 1년 / 유료 7년 | 무료 90일 | 무료 제한적 | 무제한 |

### 추천: PostHog

**선정 이유:**

1. **Expo Go 네이티브 지원** — 별도 네이티브 빌드 없이 개발 환경에서 바로 테스트 가능
2. **올인원 플랫폼** — 이벤트 분석 + 세션 리플레이 + Feature Flag + A/B 테스트를 하나의 SDK로
3. **무료 티어 충분** — 월 100만 이벤트는 DAU 5,000 기준 (유저당 일 6~7이벤트) 초기 단계에 충분
4. **오픈소스** — 벤더 락인 없음, 필요 시 셀프호스팅으로 비용 절감 가능
5. **투명한 과금** — 빌링 리밋 설정으로 예상치 못한 비용 방지

**비용 전망 (PostHog Cloud):**

| 단계 | DAU | 월 예상 이벤트 | 비용 |
|------|-----|---------------|------|
| 초기 (0~6개월) | < 1,000 | ~20만 | 무료 |
| 성장 (6~12개월) | 1,000~5,000 | 20만~100만 | 무료 |
| 확장 (12개월+) | 5,000+ | 100만+ | ~$0.31/만 이벤트 |

---

## 3. 추적 이벤트 설계

### 설계 원칙

- **네이밍 컨벤션**: `{object}_{action}` (snake_case) — PostHog 권장 형식
- **최소 수집 원칙**: 분석 목적이 명확한 이벤트만 수집
- **PII 미포함**: 이메일, 이름 등 개인식별정보는 이벤트 속성에 포함하지 않음
- **서버 사이드 보완**: 결제/삭제 등 중요 이벤트는 Supabase Edge Function에서 서버 사이드 추적

### 이벤트 목록

#### 인증 & 온보딩

| 이벤트명 | 트리거 시점 | 주요 속성 | 분석 용도 |
|----------|-----------|----------|----------|
| `app_opened` | 앱 실행 | `is_first_open`, `app_version` | DAU/MAU 측정 |
| `login_started` | 로그인 버튼 탭 | `provider` (google/apple) | 로그인 전환율 |
| `login_completed` | 로그인 성공 | `provider`, `is_new_user` | 가입 소스 분석 |
| `login_failed` | 로그인 실패 | `provider`, `error_type` | 인증 오류 추적 |
| `profile_setup_completed` | 프로필 설정 완료 | `has_photo`, `nickname_length` | 온보딩 완료율 |
| `onboarding_step_viewed` | 온보딩 각 단계 진입 | `step_number`, `step_name` | 온보딩 이탈 분석 |

#### 거래 입력 (핵심 기능)

| 이벤트명 | 트리거 시점 | 주요 속성 | 분석 용도 |
|----------|-----------|----------|----------|
| `transaction_add_started` | 추가 탭 진입 | `entry_point` (tab/home/fab) | 입력 진입 경로 |
| `transaction_saved` | 거래 저장 성공 | `type` (income/expense), `category`, `amount_range`, `has_memo`, `has_payment_method`, `input_duration_ms` | 입력 패턴, 완료율 |
| `transaction_save_failed` | 저장 실패 | `error_type`, `filled_fields` | 입력 오류 분석 |
| `transaction_abandoned` | 입력 도중 이탈 | `filled_fields`, `time_spent_ms` | 입력 UX 개선 |
| `transaction_viewed` | 거래 상세 진입 | `transaction_type`, `age_days` | 조회 패턴 |
| `transaction_updated` | 거래 수정 완료 | `changed_fields[]`, `transaction_type` | 수정 빈도/대상 |
| `transaction_deleted` | 거래 삭제 | `transaction_type`, `age_days` | 삭제 패턴 |

#### 카테고리 & 결제 수단

| 이벤트명 | 트리거 시점 | 주요 속성 | 분석 용도 |
|----------|-----------|----------|----------|
| `category_selected` | 카테고리 선택 | `category_name`, `is_custom`, `selection_method` (chip/bottomsheet) | 인기 카테고리 |
| `category_created` | 커스텀 카테고리 생성 | `icon`, `type` | 카테고리 커스텀 수요 |
| `payment_method_selected` | 결제 수단 선택 | `method_type`, `is_shared` | 결제 수단 활용도 |
| `payment_method_created` | 결제 수단 생성 | `method_type`, `is_shared` | 결제 수단 추가 패턴 |

#### 가계부 & 공유 (핵심 차별점)

| 이벤트명 | 트리거 시점 | 주요 속성 | 분석 용도 |
|----------|-----------|----------|----------|
| `ledger_created` | 가계부 생성 | `is_shared` | 가계부 생성 빈도 |
| `ledger_switched` | 가계부 전환 | `from_type`, `to_type` | 다중 가계부 활용 |
| `member_invited` | 멤버 초대 전송 | `invite_method` | 공유 전환율 |
| `member_joined` | 멤버 초대 수락 | `invite_source` | 초대 성공률 |
| `ledger_shared_action` | 공유 가계부에서 활동 | `action_type`, `member_count` | 공유 활성도 |

#### 화면 탐색

| 이벤트명 | 트리거 시점 | 주요 속성 | 분석 용도 |
|----------|-----------|----------|----------|
| `screen_viewed` | 화면 진입 | `screen_name`, `previous_screen` | 화면별 트래픽 |
| `tab_switched` | 탭 전환 | `from_tab`, `to_tab` | 탭 사용 빈도 |
| `calendar_month_changed` | 캘린더 월 변경 | `direction`, `target_month` | 과거 데이터 조회 패턴 |
| `calendar_date_tapped` | 캘린더 날짜 선택 | `has_transactions`, `days_from_today` | 캘린더 인터랙션 |

#### 설정 & 계정

| 이벤트명 | 트리거 시점 | 주요 속성 | 분석 용도 |
|----------|-----------|----------|----------|
| `settings_opened` | 설정 화면 진입 | `section` | 설정 탐색 패턴 |
| `profile_updated` | 프로필 수정 | `changed_field` | 프로필 수정 빈도 |
| `logout_completed` | 로그아웃 | `session_duration_ms` | 세션 패턴 |
| `account_deletion_started` | 탈퇴 시작 | `account_age_days`, `transaction_count` | 이탈 분석 |

### 사용자 속성 (User Properties)

PostHog의 `identify`로 설정하는 사용자 수준 속성:

| 속성명 | 설명 | 설정 시점 |
|--------|------|----------|
| `signup_date` | 가입일 | 최초 로그인 |
| `login_provider` | 로그인 방식 | 로그인 시 |
| `ledger_count` | 보유 가계부 수 | 가계부 변경 시 |
| `shared_ledger_count` | 공유 가계부 수 | 가계부 변경 시 |
| `total_transactions` | 누적 거래 수 | 거래 생성/삭제 시 |
| `app_version` | 앱 버전 | 앱 실행 시 |
| `days_since_signup` | 가입 후 일수 | 앱 실행 시 |

---

## 4. 핵심 분석 지표 (KPI)

### AARRR 퍼널

```
Acquisition (획득)
  └─ app_opened (is_first_open=true)
      │
Activation (활성화)
  └─ login_completed → profile_setup_completed → transaction_saved (첫 거래)
      │
Retention (유지)
  └─ 주간 활성 사용자 (WAU), D1/D7/D30 리텐션
      │
Revenue (수익) — Phase 2
  └─ 프리미엄 구독 전환
      │
Referral (추천)
  └─ member_invited → member_joined (바이럴 계수)
```

### 핵심 퍼널 정의

#### 퍼널 1: 온보딩 완료율

```
app_opened (first) → login_started → login_completed → profile_setup_completed → transaction_saved
```

- **목표 전환율**: ≥ 60% (앱 실행 → 첫 거래 입력)
- **분석 포인트**: 각 단계별 이탈률, 로그인 방식별 차이

#### 퍼널 2: 거래 입력 완료율

```
transaction_add_started → category_selected → transaction_saved
```

- **목표 전환율**: ≥ 80%
- **분석 포인트**: 입력 소요 시간, 이탈 필드, 카테고리 선택 방식

#### 퍼널 3: 공유 활성화율

```
ledger_created (shared) → member_invited → member_joined → ledger_shared_action
```

- **목표 전환율**: ≥ 30% (공유 가계부 생성 → 실제 공동 사용)
- **분석 포인트**: 초대 방식, 수락까지 소요 시간

### 리텐션 지표

| 지표 | 정의 | 목표 |
|------|------|------|
| D1 리텐션 | 가입 다음날 재방문 | ≥ 40% |
| D7 리텐션 | 가입 7일 후 재방문 | ≥ 30% |
| D30 리텐션 | 가입 30일 후 재방문 | ≥ 25% |
| WAU/MAU | 주간/월간 활성 비율 | ≥ 40% |
| 주간 거래 입력 빈도 | 유저당 주간 거래 입력 수 | ≥ 5회 |
| 공유 가계부 활성률 | 공유 가계부 중 2인 이상 활동 비율 | ≥ 70% |

### 세그먼트 정의

| 세그먼트 | 조건 | 용도 |
|----------|------|------|
| 신규 유저 | 가입 7일 이내 | 온보딩 최적화 |
| 활성 유저 | 최근 7일 내 거래 입력 1회+ | 핵심 지표 추적 |
| 파워 유저 | 주간 거래 10회+ AND 공유 가계부 활성 | 헤비 유저 행동 분석 |
| 휴면 유저 | 14일 이상 미접속 | 리인게이지먼트 타겟 |
| 솔로 유저 | 공유 가계부 없음 | 공유 기능 프로모션 |
| 커플 유저 | 공유 가계부 1개+ 활성 | 핵심 타겟 행동 분석 |

---

## 5. 대시보드 구성

### 운영 대시보드 (일일 확인)

- DAU / WAU / MAU 추이
- 일일 거래 입력 수 (전체 / 유저당 평균)
- 신규 가입 수 + 온보딩 완료율
- 에러 발생 현황 (login_failed, transaction_save_failed)

### 제품 대시보드 (주간 확인)

- AARRR 퍼널 전환율
- 리텐션 커브 (D1/D7/D30)
- 화면별 방문 빈도 + 체류 시간
- 인기 카테고리 TOP 10
- 공유 가계부 활성도

### 성장 대시보드 (월간 확인)

- 코호트별 리텐션 비교
- 바이럴 계수 (초대 → 가입 전환율)
- 세그먼트별 행동 차이
- Feature Flag 실험 결과

---

## 6. 구현 가이드

### SDK 설치

```bash
# Expo 호환 패키지 설치
npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
```

### Provider 설정

`_layout.tsx`의 Provider 체인에 PostHogProvider를 추가한다:

```typescript
// app/_layout.tsx
import { PostHogProvider } from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = 'https://us.i.posthog.com'; // 또는 eu.i.posthog.com

export default function RootLayout() {
  return (
    <PostHogProvider
      apiKey={POSTHOG_API_KEY}
      options={{
        host: POSTHOG_HOST,
        enableSessionReplay: true, // 세션 리플레이 활성화
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <ServiceProvider>
            <LedgerProvider>
              <ThemeProvider>
                {/* ... */}
              </ThemeProvider>
            </LedgerProvider>
          </ServiceProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </PostHogProvider>
  );
}
```

### 사용자 식별

```typescript
// contexts/AuthContext.tsx — 로그인 성공 시
import { usePostHog } from 'posthog-react-native';

const posthog = usePostHog();

// 로그인 성공 후
posthog.identify(user.id, {
  signup_date: user.created_at,
  login_provider: provider,
});

// 로그아웃 시
posthog.reset();
```

### 이벤트 추적 예시

```typescript
// hooks/useAnalytics.ts — 분석 유틸 hook
import { usePostHog } from 'posthog-react-native';

export function useAnalytics() {
  const posthog = usePostHog();

  return {
    trackTransactionSaved: (params: {
      type: 'income' | 'expense';
      category: string;
      amountRange: string;
      hasMemo: boolean;
      hasPaymentMethod: boolean;
      inputDurationMs: number;
    }) => {
      posthog.capture('transaction_saved', {
        type: params.type,
        category: params.category,
        amount_range: params.amountRange,
        has_memo: params.hasMemo,
        has_payment_method: params.hasPaymentMethod,
        input_duration_ms: params.inputDurationMs,
      });
    },

    trackScreenViewed: (screenName: string, previousScreen?: string) => {
      posthog.screen(screenName, { previous_screen: previousScreen });
    },

    trackTabSwitched: (fromTab: string, toTab: string) => {
      posthog.capture('tab_switched', {
        from_tab: fromTab,
        to_tab: toTab,
      });
    },
  };
}
```

### 자동 화면 추적 (Expo Router)

```typescript
// hooks/useScreenTracking.ts
import { usePathname } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useRef } from 'react';

export function useScreenTracking() {
  const pathname = usePathname();
  const posthog = usePostHog();
  const previousPath = useRef<string>();

  useEffect(() => {
    if (pathname) {
      posthog.screen(pathname, {
        previous_screen: previousPath.current,
      });
      previousPath.current = pathname;
    }
  }, [pathname]);
}
```

### 금액 범위 변환 (PII 보호)

금액 자체는 수집하지 않고, 범위로 변환하여 패턴만 분석한다:

```typescript
function getAmountRange(amount: number): string {
  if (amount < 5000) return 'under_5k';
  if (amount < 10000) return '5k_10k';
  if (amount < 50000) return '10k_50k';
  if (amount < 100000) return '50k_100k';
  if (amount < 500000) return '100k_500k';
  return 'over_500k';
}
```

---

## 7. 구현 로드맵

### Phase 1: 기초 설정 (1~2일)

- [ ] PostHog 프로젝트 생성 및 API 키 발급
- [ ] SDK 설치 + PostHogProvider 설정
- [ ] 환경변수 추가 (`EXPO_PUBLIC_POSTHOG_API_KEY`)
- [ ] `useAnalytics` hook 생성
- [ ] `useScreenTracking` hook + _layout.tsx 연동
- [ ] 사용자 식별 (AuthContext 연동)

### Phase 2: 핵심 이벤트 추적 (2~3일)

- [ ] 인증 이벤트 (login_started/completed/failed)
- [ ] 거래 입력 이벤트 (add.tsx — started/saved/abandoned)
- [ ] 거래 조회/수정/삭제 이벤트
- [ ] 탭 전환 + 캘린더 인터랙션 이벤트

### Phase 3: 공유 & 설정 이벤트 (1~2일)

- [ ] 가계부 생성/전환 이벤트
- [ ] 멤버 초대/수락 이벤트
- [ ] 카테고리/결제 수단 이벤트
- [ ] 설정 및 계정 이벤트

### Phase 4: 대시보드 & 분석 (1~2일)

- [ ] PostHog 대시보드 3종 구성 (운영/제품/성장)
- [ ] 핵심 퍼널 3종 설정
- [ ] 리텐션 분석 설정
- [ ] 세그먼트 6종 생성

### Phase 5: 고도화 (지속)

- [ ] 세션 리플레이 분석으로 UX 이슈 발견
- [ ] Feature Flag 기반 A/B 테스트 시작
- [ ] 서버 사이드 이벤트 추적 (Supabase Edge Function → PostHog API)
- [ ] 주간 분석 리뷰 프로세스 정착

---

## 8. 프라이버시

### 수집하지 않는 정보

- 이메일, 이름, 전화번호 등 PII
- 거래 금액 원본 (범위로 변환)
- 거래 제목/메모 내용
- 위치 정보

### 사용자 동의

- 앱 최초 실행 시 분석 데이터 수집 동의 안내
- 설정에서 분석 수집 opt-out 기능 제공
- 개인정보처리방침에 PostHog 사용 명시

### opt-out 지원

```typescript
posthog.optOut();   // 수집 중지
posthog.optIn();    // 수집 재개
```

---

## 9. 참고 자료

- [PostHog React Native 공식 문서](https://posthog.com/docs/libraries/react-native)
- [PostHog Expo 튜토리얼](https://posthog.com/tutorials/react-native-analytics)
- [Expo 공식 Analytics 가이드](https://docs.expo.dev/guides/using-analytics/)
- [PostHog 가격 정책](https://posthog.com/pricing)
- [PostHog vs Mixpanel 비교](https://posthog.com/blog/posthog-vs-mixpanel)
- [PostHog vs Amplitude 비교](https://posthog.com/blog/best-amplitude-alternatives)
- [Mixpanel React Native SDK](https://docs.mixpanel.com/docs/tracking-methods/sdks/react-native)
- [Amplitude React Native SDK](https://amplitude.com/docs/sdks/analytics/react-native/react-native-sdk)
