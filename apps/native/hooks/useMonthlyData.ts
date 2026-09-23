import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TransactionService } from '@repo/core';
import { useServices } from '../contexts/ServiceContext';
import { useLedger } from '../contexts/LedgerContext';
import { queryKeys } from '../utils/queryClient';
import type { CalendarTransaction } from '../components/shared/calendar/types';

interface MonthlySummary {
  income: number;
  expense: number;
  balance: number;
}

interface MonthlyDataResult {
  calendarData: CalendarTransaction | null;
  monthlySummary: MonthlySummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * API 응답의 일별 데이터를 캘린더 컴포넌트 형식으로 변환
 * @param dailySummary - API에서 받은 날짜별 수입/지출 데이터 (YYYY-MM-DD 형식)
 * @returns 캘린더 컴포넌트용 데이터 (YYYY-MM-DD 형식을 키로 사용)
 */
function transformToCalendarData(
  dailySummary: Record<string, unknown>
): CalendarTransaction {
  const calendarTransactions: CalendarTransaction = {};

  Object.entries(dailySummary).forEach(([dateStr, amounts]) => {
    // 타입 안전성을 위한 타입 단언
    const dayAmounts = amounts as { income: number; expense: number };

    // 수입이나 지출이 있는 날만 포함
    if (dayAmounts.income > 0 || dayAmounts.expense > 0) {
      // 전체 날짜 문자열을 그대로 키로 사용
      calendarTransactions[dateStr] = {
        income: dayAmounts.income,
        expense: dayAmounts.expense,
      };
    }
  });

  return calendarTransactions;
}

interface MonthlyData {
  calendarData: CalendarTransaction;
  monthlySummary: MonthlySummary;
}

async function fetchMonthlyData(
  transactionService: TransactionService,
  ledgerId: string,
  year: number,
  month: number
): Promise<MonthlyData> {
  const summary = await transactionService.getCalendarSummary(
    ledgerId,
    year,
    month
  );
  return {
    calendarData: transformToCalendarData(summary.dailySummary),
    monthlySummary: summary.monthlyTotal,
  };
}

/** 월을 넘기면 바로 보이도록 앞뒤 달을 미리 받아둔다 */
function useAdjacentMonthsPrefetch(
  ledgerId: string | undefined,
  year: number,
  month: number
) {
  const queryClient = useQueryClient();
  const { transactionService } = useServices();

  useEffect(() => {
    if (!ledgerId) return;

    for (const offset of [-1, 1]) {
      const adjacent = new Date(year, month - 1 + offset, 1);
      const adjacentYear = adjacent.getFullYear();
      const adjacentMonth = adjacent.getMonth() + 1;
      queryClient.prefetchQuery({
        queryKey: queryKeys.monthlySummary.month(
          ledgerId,
          adjacentYear,
          adjacentMonth
        ),
        queryFn: () =>
          fetchMonthlyData(
            transactionService,
            ledgerId,
            adjacentYear,
            adjacentMonth
          ),
        // 캐시가 조금이라도 있으면 받지 않는다. 그 달로 넘어가면 그때 다시 받는다.
        staleTime: Infinity,
      });
    }
  }, [ledgerId, year, month, queryClient, transactionService]);
}

export function useMonthlyData(year: number, month: number): MonthlyDataResult {
  const { transactionService } = useServices();
  const { currentLedger } = useLedger();
  const ledgerId = currentLedger?.id;

  const query = useQuery({
    queryKey: queryKeys.monthlySummary.month(ledgerId, year, month),
    queryFn: () => fetchMonthlyData(transactionService, ledgerId!, year, month),
    enabled: !!ledgerId,
  });

  useAdjacentMonthsPrefetch(ledgerId, year, month);

  const { refetch: refetchQuery } = query;
  const refetch = useCallback(async () => {
    if (ledgerId) await refetchQuery({ cancelRefetch: false });
  }, [ledgerId, refetchQuery]);

  return {
    // 다른 달의 값을 대신 보여주지 않는다. 새 달 데이터가 올 때까지는 비워둔다.
    calendarData: query.data?.calendarData ?? null,
    monthlySummary: query.data?.monthlySummary ?? null,
    // isPending은 가계부가 없어 비활성일 때도 true라 쓰지 않는다. 홈 스플래시가 이 값을 기다린다.
    loading: query.isLoading,
    error: query.error,
    refetch,
  };
}
