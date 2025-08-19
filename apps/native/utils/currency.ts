/**
 * 통합 금액 포맷팅 시스템
 * 
 * 모든 금액 표시를 일관되게 처리하는 핵심 유틸리티
 * - 수입/지출 부호 처리
 * - 다양한 포맷 옵션 (full, compact, abbreviated)
 * - 통화 및 색상 정보 제공
 */

export type TransactionType = 'income' | 'expense' | 'neutral';
export type FormatType = 'full' | 'compact' | 'abbreviated' | 'calendar';

/**
 * 금액 포맷팅 옵션
 */
export interface FormatAmountOptions {
  /** 금액 (항상 절댓값으로 처리됨) */
  amount: number;
  /** 거래 타입 */
  type: TransactionType;
  /** 포맷 형식 (기본: 'full') */
  format?: FormatType;
  /** 부호 표시 여부 (기본: true) */
  showSign?: boolean;
  /** 통화 표시 여부 (기본: false) */
  showCurrency?: boolean;
  /** 통화 단위 (기본: '원') */
  currency?: string;
}

/**
 * 포맷팅 결과
 */
export interface FormatResult {
  /** 부호 문자열 ('+', '-', '') */
  sign: string;
  /** 포맷된 숫자 문자열 */
  value: string;
  /** 통화 문자열 */
  currency: string;
  /** 최종 조합된 문자열 */
  formatted: string;
  /** 색상 키 */
  colorKey: TransactionType;
}

/**
 * 거래 타입에 따른 부호 반환
 */
function getSign(type: TransactionType, showSign: boolean): string {
  if (!showSign) return '';
  if (type === 'income') return '+';
  if (type === 'expense') return '-';
  return '';
}

/**
 * 숫자를 축약 형태로 변환 (5000000 → 5M)
 */
function abbreviateNumber(amount: number): string {
  if (amount === 0) return '0';
  
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1000000) {
    // 백만 단위 (M)
    const millions = absAmount / 1000000;
    return `${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  } else if (absAmount >= 1000) {
    // 천 단위 (k)
    const thousands = absAmount / 1000;
    return `${thousands >= 10 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  
  return absAmount.toString();
}

/**
 * 포맷 타입에 따른 값 변환
 */
function formatValue(amount: number, format: FormatType): string {
  const absAmount = Math.abs(amount);
  
  switch (format) {
    case 'abbreviated':
      return abbreviateNumber(absAmount);
    case 'calendar':
      // 캘린더용: 천만원 미만은 전체 표시, 이상은 M 단위 축약
      if (absAmount >= 10000000) {
        const millions = absAmount / 1000000;
        return `${millions >= 100 ? millions.toFixed(0) : millions.toFixed(1)}M`;
      }
      return absAmount.toLocaleString('ko-KR');
    case 'compact':
    case 'full':
    default:
      return absAmount.toLocaleString('ko-KR');
  }
}

/**
 * 메인 금액 포맷팅 함수
 * 
 * @example
 * formatAmount({ amount: 50000, type: 'expense' })
 * // → { formatted: '-50,000', sign: '-', value: '50,000', colorKey: 'expense' }
 * 
 * formatAmount({ amount: 5000000, type: 'income', format: 'abbreviated' })
 * // → { formatted: '+5M', sign: '+', value: '5M', colorKey: 'income' }
 */
export function formatAmount(options: FormatAmountOptions): FormatResult {
  const {
    amount,
    type,
    format = 'full',
    showSign = true,
    showCurrency = false,
    currency = '원'
  } = options;

  // 1. 부호 결정
  const sign = getSign(type, showSign);
  
  // 2. 값 포맷팅
  const value = formatValue(amount, format);
  
  // 3. 통화 처리
  const currencyStr = showCurrency ? currency : '';
  
  // 4. 최종 조합
  const formatted = `${sign}${value}${currencyStr}`;
  
  return {
    sign,
    value,
    currency: currencyStr,
    formatted,
    colorKey: type,
  };
}

/**
 * 간편한 금액 포맷팅 (기본 옵션 사용)
 */
export function formatSimpleAmount(amount: number, type: TransactionType): string {
  return formatAmount({ amount, type }).formatted;
}

/**
 * 축약형 금액 포맷팅 (일반용)
 */
export function formatCompactAmount(amount: number, type: TransactionType): string {
  return formatAmount({ 
    amount, 
    type, 
    format: 'abbreviated' 
  }).formatted;
}

/**
 * 캘린더용 금액 포맷팅 (천만원 미만은 전체 표시, 이상은 M 단위)
 */
export function formatCalendarAmount(amount: number, type: TransactionType): string {
  return formatAmount({ 
    amount, 
    type, 
    format: 'calendar' 
  }).formatted;
}

/**
 * 통화 포함 금액 포맷팅
 */
export function formatAmountWithCurrency(amount: number, type: TransactionType, currency: string = '원'): string {
  return formatAmount({ 
    amount, 
    type, 
    showCurrency: true, 
    currency 
  }).formatted;
}