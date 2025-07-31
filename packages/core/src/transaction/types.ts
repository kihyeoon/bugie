import type { CategoryType } from '@repo/types';

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

export interface TransactionFilter {
  ledgerId: string;
  startDate?: string;
  endDate?: string;
  type?: CategoryType;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export interface MonthlySummary {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  transactionCount: number;
  dailySummary: Record<string, { income: number; expense: number }>;
}
