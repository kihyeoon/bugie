/**
 * 도메인 공통 유틸리티 함수
 */

import { VALID_CURRENCY_CODES, DEFAULT_CURRENCY } from './constants';
import type { CurrencyCode } from './types';

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