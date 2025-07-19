# Product Requirements Document

## 1. Executive Summary

“공유가계부(가칭)”는 부부가 모바일·웹에서 동시에 접속해 자산·소비 현황을 실시간으로 확인·관리할 수 있는 공유 가계부 서비스다. 수입·지출 기록, 예산 설정 기능을 제공해 금전 대화를 줄이고 재무 투명성을 높인다.

## 2. Problem Statement

• 기존 가계부는 1인 사용 위주여서 부부가 동일한 데이터를 보려면 화면을 공유하거나 내보내기가 필요하다.  
• 카카오톡·스프레드시트 등 임시 방법은 자동화·보안·편의성이 부족하다.  
• 시장에는 개인 재무관리 앱은 많으나, “공동 재무관리”에 특화된 국산 서비스는 드물다. 신혼부부·맞벌이 부부의 실질적 수요가 충족되지 않는다.

## 3. Goals and Objectives

- Primary Goal: 부부가 하나의 가계부를 공유해 자산 현황·예산·지출 패턴을 투명하게 관리
- Secondary Goals:  
  • 예산 초과 시 알림 제공으로 소비 습관 개선  
  • 맞춤형 인사이트 제공으로 재무 계획 수립 지원
- Success Metrics:  
  • DAU ≥ 5,000 (6개월)  
  • 월평균 공유 가계부 작성률 ≥ 70%  
  • 예산 초과 알림 후 소비 감소율 10% 이상  
  • NPS ≥ 40

## 4. Target Audience

### Primary Users

- 20~30대 신혼·맞벌이 부부
- 스마트폰 활용도 높고, 자산·지출 투명성 니즈가 강함
- 금융 서비스와 앱 구독 경험이 있으며 UX에 민감

### Secondary Users

- 결혼 예정 커플, 동거 파트너
- 금융사·핀테크 파트너, 광고주

## 5. User Stories

- 부부(공동소유자)로서, 서로 다른 기기에서 같은 가계부를 실시간으로 편집·조회하고 싶다.
- 예산을 초과하면 즉시 알림을 받아 과소비를 방지하고 싶다.
- 수입·지출을 빠르게 입력하여 입력 시간을 절약하고 싶다.
- 월말에 카테고리별 소비 리포트를 보고 다음 달 계획을 세우고 싶다.
- 중요한 금융 데이터가 안전하게 암호화돼야 안심하고 사용할 수 있다.

## 6. Functional Requirements

### Core Features

1. 공유 가계부
   - 하나의 가계부에 최대 여러명 동시 접근
   - 역할: 소유자·편집자·조회자 권한 구분
   - AC: 두 사용자가 각각 입력·편집 시 3초 이내 실시간 동기화

2. 수입·지출 입력/분류
   - 수동 입력: 항목, 금액, 카테고리, 결제수단, 메모
   - 자동 분류: 카테고리 추천 정확도 80% 이상

3. 지출 예산 관리
   - 월/주 카테고리별 예산 설정
   - 예산 사용률 80%, 100% 돌파 시 푸시·이메일 알림

### Supporting Features

- 금융 대시보드(총자산, 부채, 순자산)
- 소비 분석 리포트(그래프, TOP 지출 카테고리)
- CSV 내보내기 및 PDF 리포트
- 다크모드, 위젯(모바일)
- 다국어(국/영)

## 7. Non-Functional Requirements

- Performance: 주요 뷰 1.5초 내 로드, 동기화 지연 ≤ 3초
- Security: OAuth 2.0, TLS 1.3, 데이터 AES-256 암호화, OWASP Mobile Top10 대응
- Usability: iOS HIG / Material Design 준수, 학습 곡선 ≤ 5분
- Scalability: 100K 동시 사용자 대비
- Compatibility: iOS 15+, Android 8+, 최신 Chrome/Safari/Edge

## 8. Technical Considerations

- 프론트엔드: Next.js(SSR) + Expo(React Native) 단일 코드베이스
- 백엔드: Supabase(Postgres, Realtime), Edge Functions for Webhooks
- 인증: Supabase Auth + 소셜 로그인(Google, Apple, Kakao)
- 데이터: Postgres 파티셔닝, S3 호환 스토리지(영수증 사진)
- Infra: AWS
- Monitoring: Sentry

## 9. Success Metrics and KPIs

- 사용자: WAU/MAU 비율 ≥ 40%, 리텐션(D30) ≥ 25%
- 비즈니스: 프리미엄 구독 전환율 5%, ARPU ₩3,000/월
- 기술: 오류 비율 < 0.1%, 평균 응답시간 < 300ms

## 10. Timeline and Milestones

- Phase 1 (M1~M3):  
  • 기본 가계부, 수동 입력, 공유·동기화, 예산, 웹·앱 출시
- Phase 2 (M4~M6):  
  • 자동 분류, 소비 분석 리포트, 유료 구독 시작
- Phase 3 (M7~M9):  
  • AI 소비 패턴 예측, 금융상품 추천, 글로벌화

## 11. Risks and Mitigation

- 데이터 유출 우려 → 정기 침투 테스트, 보안 인증(ISMS) 추진
- 사용자 채널 혼잡 → 인앱 가이드, 온보딩 튜토리얼
- 결제 거부감 → 무료 체험 30일, 교육 콘텐츠 제공

## 12. Future Considerations

- 음성·OCR 영수증 입력
- AI 챗봇 가계부 코치
- 자녀 용돈 계정
- 오프라인 결제 QR 연동 및 현금영수증 자동 처리
