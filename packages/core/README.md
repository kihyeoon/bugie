# @repo/core

Bugie 애플리케이션의 비즈니스 로직과 도메인 규칙을 담당하는 코어 패키지입니다.

## 📋 개요

`@repo/core`는 클린 아키텍처 원칙을 따라 설계된 비즈니스 로직 패키지입니다. 도메인 중심 설계(DDD)를 통해 비즈니스 규칙을 명확하게 표현하고, 외부 의존성으로부터 독립적인 구조를 유지합니다.

## ✨ 주요 특징

- **🏛️ 클린 아키텍처**: Domain, Application, Infrastructure 3계층 구조
- **🔒 타입 안전성**: TypeScript를 활용한 강력한 타입 시스템
- **🔄 의존성 역전**: 인터페이스를 통한 느슨한 결합
- **📦 도메인 독립성**: 외부 라이브러리 의존성 없는 순수한 도메인 로직
- **🧪 테스트 용이성**: 각 계층의 독립적인 테스트 가능

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                   │
│                  (Web App / Native App)                 │
└─────────────────────┬───────────────────────────────────┘
                      │ Uses
┌─────────────────────▼───────────────────────────────────┐
│                  Application Layer                      │
│              (Services / Use Cases)                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │ • LedgerService    • TransactionService         │    │
│  │ • Input/Output DTOs • Orchestration Logic       │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────┘
                      │ Uses
┌─────────────────────▼───────────────────────────────────┐
│                     Domain Layer                        │
│              (Entities / Business Rules)                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ • Entities (Ledger, Transaction, Category)      │    │
│  │ • Business Rules • Value Objects                │    │
│  │ • Domain Errors  • Repository Interfaces        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────┘
                      │ Implements
┌─────────────────────▼───────────────────────────────────┐
│                 Infrastructure Layer                    │
│            (External Systems / Adapters)                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ • Supabase Repositories • Auth Service          │    │
│  │ • DB ↔ Domain Mappers  • External APIs          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 계층별 책임

#### Domain Layer (`/domain`)

- **역할**: 핵심 비즈니스 로직과 규칙 정의
- **특징**: 외부 의존성 없음, 순수 TypeScript
- **구성요소**:
  - Entities (LedgerEntity, TransactionEntity)
  - Business Rules (LedgerRules, TransactionRules)
  - Repository Interfaces
  - Domain Errors

#### Application Layer (`/application`)

- **역할**: 유스케이스 구현, 비즈니스 로직 조율
- **특징**: 도메인 레이어만 의존
- **구성요소**:
  - Services (LedgerService, TransactionService)
  - Input/Output DTOs
  - Use Case Implementation

#### Infrastructure Layer (`/infrastructure`)

- **역할**: 외부 시스템과의 통합
- **특징**: 도메인 인터페이스 구현
- **구성요소**:
  - Supabase Repositories
  - DB ↔ Domain Mappers
  - External Service Adapters

## 🚀 설치 및 사용법

### 설치

```bash
pnpm add @repo/core
```

### 기본 사용법

```typescript
import { createLedgerService, createTransactionService } from '@repo/core';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 서비스 인스턴스 생성
const ledgerService = createLedgerService(supabase);
const transactionService = createTransactionService(supabase);

// 가계부 생성 예제
const newLedger = await ledgerService.createLedger({
  name: '우리집 가계부',
  description: '가족 공동 가계부',
  currency: 'KRW',
});

// 거래 내역 조회 예제
const transactions = await transactionService.getTransactions({
  ledgerId: newLedger.id,
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  limit: 20,
});
```

## 📚 주요 API

### LedgerService

| 메서드                    | 설명                      | 반환 타입                |
| ------------------------- | ------------------------- | ------------------------ |
| `getLedgers()`            | 사용자의 모든 가계부 조회 | `LedgerWithMembers[]`    |
| `getLedger(id)`           | 특정 가계부 상세 조회     | `LedgerDetail`           |
| `createLedger(input)`     | 새 가계부 생성            | `{ id, name, currency }` |
| `updateLedger(id, input)` | 가계부 정보 수정          | `void`                   |
| `deleteLedger(id)`        | 가계부 삭제               | `void`                   |
| `inviteMember(input)`     | 멤버 초대                 | `void`                   |

### TransactionService

| 메서드                                     | 설명                | 반환 타입                |
| ------------------------------------------ | ------------------- | ------------------------ |
| `getTransactions(filter)`                  | 거래 내역 조회      | `{ data, count }`        |
| `getTransaction(id)`                       | 특정 거래 상세 조회 | `TransactionWithDetails` |
| `createTransaction(input)`                 | 새 거래 생성        | `string` (ID)            |
| `updateTransaction(id, input)`             | 거래 수정           | `void`                   |
| `deleteTransaction(id)`                    | 거래 삭제           | `void`                   |
| `getMonthlySummary(ledgerId, year, month)` | 월별 요약           | `MonthlySummary`         |

### 주요 타입

```typescript
// 도메인 타입
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type CategoryType = 'income' | 'expense';
export type CurrencyCode = 'KRW' | 'USD' | 'EUR' | 'JPY';

// 입력 타입
export interface CreateLedgerInput {
  name: string;
  description?: string;
  currency?: CurrencyCode;
}

export interface CreateTransactionInput {
  ledgerId: string;
  categoryId: string;
  amount: number;
  type: CategoryType;
  title: string;
  description?: string;
  transactionDate?: string;
}

// 에러 타입
export class DomainError extends Error {}
export class ValidationError extends DomainError {}
export class UnauthorizedError extends DomainError {}
export class NotFoundError extends DomainError {}
```

## 📁 프로젝트 구조

```
src/
├── domain/                    # 도메인 레이어
│   ├── auth/                 # 인증 도메인
│   │   └── types.ts         # 인증 관련 타입
│   ├── ledger/              # 가계부 도메인
│   │   ├── types.ts        # 엔티티 및 리포지토리 인터페이스
│   │   └── rules.ts        # 비즈니스 규칙
│   ├── transaction/         # 거래 도메인
│   │   ├── types.ts        # 엔티티 및 리포지토리 인터페이스
│   │   └── rules.ts        # 비즈니스 규칙
│   └── shared/              # 공통 도메인
│       ├── types.ts        # 공통 타입 (EntityId, DomainDate 등)
│       └── errors.ts       # 도메인 에러
│
├── application/              # 애플리케이션 레이어
│   ├── ledger/              # 가계부 서비스
│   │   ├── LedgerService.ts
│   │   └── types.ts        # Input/Output DTOs
│   └── transaction/         # 거래 서비스
│       ├── TransactionService.ts
│       └── types.ts        # Input/Output DTOs
│
├── infrastructure/           # 인프라스트럭처 레이어
│   └── supabase/            # Supabase 통합
│       ├── auth/            # 인증 서비스 구현
│       │   └── SupabaseAuthService.ts
│       ├── mappers/         # DB ↔ Domain 매핑
│       │   ├── LedgerMapper.ts
│       │   ├── CategoryMapper.ts
│       │   └── TransactionMapper.ts
│       └── repositories/    # 리포지토리 구현
│           ├── LedgerRepository.ts
│           └── TransactionRepository.ts
│
├── shared/                   # UI 레이어용 공유 타입
│   └── types.ts             # API 응답 타입
│
└── index.ts                 # 패키지 진입점
```

## 🔧 개발 가이드

### 새로운 기능 추가하기

1. **도메인 레이어**: 엔티티와 비즈니스 규칙 정의
2. **애플리케이션 레이어**: 서비스와 유스케이스 구현
3. **인프라 레이어**: 리포지토리와 매퍼 구현
4. **타입 export**: index.ts에 필요한 타입 추가

### 코딩 컨벤션

- 도메인 레이어는 외부 의존성을 가지지 않습니다
- 모든 public API는 명확한 타입을 가져야 합니다
- 에러는 도메인 에러를 상속받아 구현합니다
- 리포지토리는 인터페이스를 먼저 정의합니다

## 📄 라이선스

이 프로젝트는 Bugie 애플리케이션의 일부입니다.
