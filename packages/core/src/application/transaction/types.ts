import type { CategoryType } from '../../domain/ledger/types';

/**
 * 애플리케이션 레이어 입력 타입
 */

export interface CreateTransactionInput {
  ledgerId: string;
  categoryId: string;
  amount: number;
  type: CategoryType;
  title: string;
  description?: string;
  transactionDate?: string;
}

export interface UpdateTransactionInput {
  categoryId?: string;
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