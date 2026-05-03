/**
 * 도메인 공통 유틸리티 함수
 */

import { VALID_CURRENCY_CODES, DEFAULT_CURRENCY } from './constants';
import type { CurrencyCode } from './types';

// ============================================================
// 날짜 관련 유틸리티
// ============================================================

/**
 * Date를 로컬 시간대 기준 YYYY-MM-DD 문자열로 변환.
 *
 * `toISOString()`은 UTC로 변환하므로 KST 자정의 Date는 전날로 밀리는 문제가 있음.
 * DB의 `transaction_date`(DATE 타입)는 시간대가 없는 달력 날짜이므로
 * 로컬 시간대를 기준으로 직렬화해야 사용자가 의도한 날짜와 일치한다.
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * DB DATE 컬럼(YYYY-MM-DD)을 로컬 자정 Date로 파싱.
 *
 * `new Date("YYYY-MM-DD")`는 UTC 자정으로 해석되므로 음수 오프셋 환경에서
 * `getDate()`가 전날을 반환할 수 있다. `formatLocalDate`와의 라운드트립
 * 일관성을 위해 시간 부분을 명시해 로컬 자정으로 파싱한다.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

// ============================================================
// 통화 관련 유틸리티
// ============================================================

/**
 * CurrencyCode 타입 가드
 * @param value 검증할 값
 * @returns CurrencyCode 타입인지 여부
 */
export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && VALID_CURRENCY_CODES.includes(value as CurrencyCode);
}

/**
 * 문자열을 CurrencyCode로 안전하게 변환
 * @param value 변환할 문자열
 * @param defaultCurrency 기본값 (기본: KRW)
 * @returns 유효한 CurrencyCode
 */
export function toCurrencyCode(
  value: string | undefined, 
  defaultCurrency: CurrencyCode = DEFAULT_CURRENCY
): CurrencyCode {
  if (!value) return defaultCurrency;
  return isCurrencyCode(value) ? value : defaultCurrency;
}