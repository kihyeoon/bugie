import { useState, useEffect, useCallback, useMemo } from 'react';
import { SectionListData } from 'react-native';
import { useServices } from '../contexts/ServiceContext';
import type { TransactionWithDetails, CalendarData } from '@repo/core';

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
  calendarData: CalendarData;
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

const PAGE_SIZE = 20;

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
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // 월의 날짜 범위 계산
  const startDate = useMemo(() => {
    return new Date(year, month - 1, 1).toISOString().split('T')[0];
  }, [year, month]);

  const endDate = useMemo(() => {
    return new Date(year, month, 0).toISOString().split('T')[0];
  }, [year, month]);

  // 거래 내역 가져오기
  const fetchTransactions = useCallback(
    async (reset: boolean = false) => {
      if (!ledgerId) {
        setLoading(false);
        return;
      }

      try {
        const currentOffset = reset ? 0 : offset;

        const result = await transactionService.getTransactions({
          ledgerId,
          startDate,
          endDate,
          categoryId,
          type,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });

        if (result && result.data) {
          if (reset) {
            setTransactions(result.data);
            setOffset(PAGE_SIZE);
          } else {
            setTransactions((prev) => [...prev, ...result.data]);
            setOffset((prev) => prev + PAGE_SIZE);
          }

          setHasMore(
            result.count !== null &&
              (reset ? PAGE_SIZE : offset + PAGE_SIZE) < result.count
          );
        }
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    },
    [ledgerId, startDate, endDate, categoryId, type, offset, transactionService]
  );

  // 초기 가져오기
  useEffect(() => {
    setLoading(true);
    setOffset(0);
    fetchTransactions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerId, year, month, categoryId, type]);

  // 페이지네이션을 위한 더 불러오기 함수
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchTransactions(false);
  }, [hasMore, loading, fetchTransactions]);

  // 다시 가져오기 함수
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchTransactions(true);
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

  // 캘린더 데이터 형식으로 변환
  const calendarData = useMemo(() => {
    const data: CalendarData = {};

    transactions.forEach((transaction) => {
      const date = transaction.transaction_date;
      if (!data[date]) {
        data[date] = { income: 0, expense: 0 };
      }

      const amount = Number(transaction.amount);
      if (transaction.type === 'income') {
        data[date].income += amount;
      } else {
        data[date].expense += amount;
      }
    });

    return data;
  }, [transactions]);

  return {
    transactions,
    groupedTransactions,
    calendarData,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
  };
}
