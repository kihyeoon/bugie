import type { CategoryType } from '../../domain/ledger/types';

/**
 * 애플리케이션 레이어 입력 타입
 */

export interface CreateTransactionInput {
  ledgerId: string;
  categoryId: string;
  paidBy?: string;
  paymentMethodId?: string;
  amount: number;
  type: CategoryType;
  title: string;
  description?: string;
  /** YYYY-MM-DD (formatLocalDate) */
  transactionDate?: string;
}

export interface UpdateTransactionInput {
  categoryId?: string;
  paidBy?: string;
  /** undefined = 변경 없음, null = 결제 수단 해제, string = 변경 */
  paymentMethodId?: string | null;
  amount?: number;
  type?: CategoryType;
  title?: string;
  description?: string;
  /** YYYY-MM-DD (formatLocalDate) */
  transactionDate?: string;
}

export interface TransactionFilterInput {
  ledgerId: string;
  /** YYYY-MM-DD (formatLocalDate) */
  startDate?: string;
  /** YYYY-MM-DD (formatLocalDate) */
  endDate?: string;
  type?: CategoryType;
  categoryId?: string;
  /** 누구의 거래인가: 지출자, 없으면 작성자 */
  memberId?: string;
  limit?: number;
  offset?: number;
}

/** 거래 검색. 기간 없이 가계부 전체에서 제목·메모 부분 일치 (docs/features/search/design.md) */
export interface TransactionSearchInput {
  ledgerId: string;
  /** normalizeKeyword로 정리된 값. 비어 있으면 DB가 0건을 돌려준다 */
  keyword: string;
  limit: number;
}
