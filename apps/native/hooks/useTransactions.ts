import { useCallback, useMemo } from 'react';
import { SectionListData } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../contexts/ServiceContext';
import { queryKeys } from '../utils/queryClient';
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
  const { refetch: refetchQuery } = query;

  // useQuery의 refetch는 enabled를 무시한다. 홈은 날짜를 고르기 전에도 포커스마다 refetch를 부르므로 여기서 막는다.
  // 마운트 직후 포커스 refetch가 겹치면 진행 중인 요청을 같이 쓴다(기본값은 취소 후 재요청).
  const refetch = useCallback(async () => {
    if (isEnabled) await refetchQuery({ cancelRefetch: false });
  }, [isEnabled, refetchQuery]);

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
    // isPending은 비활성 쿼리에서도 true라 쓰지 않는다. 데이터가 없고 실제로 받는 중일 때만 로딩이다.
    loading: query.isLoading,
    error: query.error,
    refetch,
  };
}
