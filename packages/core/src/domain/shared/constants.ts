/**
 * 도메인 공통 상수 정의
 */

// ============================================================
// 통화 관련 상수
// ============================================================

/**
 * 지원되는 통화 코드 목록
 */
export const VALID_CURRENCY_CODES = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'] as const;

/**
 * 기본 통화 코드
 */
export const DEFAULT_CURRENCY = 'KRW' as const;

// ============================================================
// 가계부 관련 상수
// ============================================================

/**
 * 가계부 이름 최대 길이
 */
export const LEDGER_MAX_NAME_LENGTH = 50;

/**
 * 가계부 이름 최소 길이
 */
export const LEDGER_MIN_NAME_LENGTH = 1;

/**
 * 가계부당 최대 멤버 수
 */
export const MAX_MEMBERS_PER_LEDGER = 20;

// ============================================================
// 카테고리 관련 상수
// ============================================================

/**
 * 카테고리 이름 최대 길이
 */
export const CATEGORY_MAX_NAME_LENGTH = 20;

/**
 * 카테고리 기본 색상
 */
export const CATEGORY_DEFAULT_COLOR = '#6B7280';

/**
 * 카테고리 기본 아이콘
 */
export const CATEGORY_DEFAULT_ICON = 'pricetag';

/**
 * 카테고리 기본 정렬 순서
 */
export const CATEGORY_DEFAULT_SORT_ORDER = 999;