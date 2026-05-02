import { useState, useEffect, useCallback, useMemo } from 'react';
import { SectionListData } from 'react-native';
import { useServices } from '../contexts/ServiceContext';
import type { TransactionWithDetails } from '@repo/core';

interface UseTransactionsOptions {
  ledgerId?: string;
  year: number;
  month: number;
  categoryId?: string;
  type?: 'income' | 'expense';
}

// GroupedTransaction은 타입 호환성을 위해 SectionListData를 확장
interface GroupedTransaction
  extends SectionListData<TransactionWithDetails, { date: string }> {
  date: string;
  data: TransactionWithDetails[];
}

interface UseTransactionsReturn {
  transactions: TransactionWithDetails[];
  groupedTransactions: GroupedTransaction[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// 한 달 단위 화면이라 페이지네이션 없이 한 번에 로드. 일반 사용자 한 달 거래량 상한선을 넉넉히 잡음.
const FETCH_LIMIT = 1000;

export function useTransactions({
  ledgerId,
  year,
  month,
  categoryId,
  type,
}: UseTransactionsOptions): UseTransactionsReturn {
  const { transactionService } = useServices();
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 월의 날짜 범위 계산
  const startDate = useMemo(() => {
    return new Date(year, month - 1, 1).toISOString().split('T')[0];
  }, [year, month]);

  const endDate = useMemo(() => {
    return new Date(year, month, 0).toISOString().split('T')[0];
  }, [year, month]);

  const fetchTransactions = useCallback(async () => {
    if (!ledgerId) {
      setLoading(false);
      return;
    }

    try {
      const result = await transactionService.getTransactions({
        ledgerId,
        startDate,
        endDate,
        categoryId,
        type,
        limit: FETCH_LIMIT,
        offset: 0,
      });

      if (result && result.data) {
        setTransactions(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [ledgerId, startDate, endDate, categoryId, type, transactionService]);

  useEffect(() => {
    setLoading(true);
    fetchTransactions();
  }, [fetchTransactions]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchTransactions();
  }, [fetchTransactions]);

  // 날짜별로 거래 그룹화
  const groupedTransactions = useMemo(() => {
    const grouped: Record<string, TransactionWithDetails[]> = {};

    transactions.forEach((transaction) => {
      const date = transaction.transaction_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
    });

    // 배열로 변환하고 날짜별 정렬 (내림차순)
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, transactions]) => ({
        date,
        data: transactions, // SectionList는 'data' 속성을 기대함
      }));
  }, [transactions]);

  return {
    transactions,
    groupedTransactions,
    loading,
    error,
    refetch,
  };
}
