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
  transactionDate?: string;
}

export interface TransactionFilterInput {
  ledgerId: string;
  startDate?: string;
  endDate?: string;
  type?: CategoryType;
  categoryId?: string;
  limit?: number;
  offset?: number;
}
