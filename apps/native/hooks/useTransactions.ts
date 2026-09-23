import { useMemo } from 'react';
import { SectionListData } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../contexts/ServiceContext';
import { queryKeys } from '../utils/queryClient';
import { useQueryStatus } from './useQueryStatus';
import { formatLocalDate, type TransactionWithDetails } from '@repo/core';

interface UseTransactionsOptions {
  ledgerId?: string;
  year: number;
  month: number;
  categoryId?: string;
  type?: 'income' | 'expense';
  /** false면 fetch하지 않는다. 홈처럼 날짜를 고른 뒤에야 필요한 화면에서 지연 로드용. */
  enabled?: boolean;
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

const NO_TRANSACTIONS: TransactionWithDetails[] = [];

export function useTransactions({
  ledgerId,
  year,
  month,
  categoryId,
  type,
  enabled = true,
}: UseTransactionsOptions): UseTransactionsReturn {
  const { transactionService } = useServices();
  const isEnabled = enabled && !!ledgerId;

  const query = useQuery({
    queryKey: queryKeys.transactions.month(ledgerId, year, month, {
      categoryId,
      type,
    }),
    queryFn: async () => {
      const result = await transactionService.getTransactions({
        ledgerId: ledgerId!,
        startDate: formatLocalDate(new Date(year, month - 1, 1)),
        endDate: formatLocalDate(new Date(year, month, 0)),
        categoryId,
        type,
        limit: FETCH_LIMIT,
        offset: 0,
      });
      return result.data;
    },
    enabled: isEnabled,
  });

  const transactions = query.data ?? NO_TRANSACTIONS;
  const { loading, error, refetch } = useQueryStatus(query, isEnabled);

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
