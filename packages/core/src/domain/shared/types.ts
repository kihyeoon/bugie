/**
 * 도메인 공통 타입 정의
 */

/**
 * 엔티티 ID 타입
 */
export type EntityId = string;

/**
 * 날짜 타입 (도메인에서는 Date 객체 사용)
 */
export type DomainDate = Date;

/**
 * 통화 코드
 */
export type CurrencyCode = 'KRW' | 'USD' | 'EUR' | 'JPY' | 'CNY';

/**
 * 금액 값 객체
 */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/**
 * 페이징 정보
 */
export interface PaginationInfo {
  limit: number;
  offset: number;
}

/**
 * 정렬 정보
 */
export interface SortInfo<T> {
  field: keyof T;
  direction: 'asc' | 'desc';
}

/**
 * 도메인 이벤트 기본 인터페이스
 */
export interface DomainEvent {
  eventName: string;
  aggregateId: EntityId;
  occurredAt: DomainDate;
  data: Record<string, unknown>;
}