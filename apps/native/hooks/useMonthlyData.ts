import { useEffect } from 'react';
import { addMonths } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TransactionService } from '@repo/core';
import { useServices } from '../contexts/ServiceContext';
import { useLedger } from '../contexts/LedgerContext';
import { queryKeys } from '../utils/queryClient';
import { useQueryStatus } from './useQueryStatus';
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

/**
 * 월을 넘기면 바로 보이도록 앞뒤 달을 미리 받아둔다.
 * 현재 달을 받은 뒤에만, 캐시에 없는 달만 받는다. 첫 화면 요청과 경쟁하지 않고,
 * 이미 받아둔 달은 그 달로 넘어갈 때 어차피 다시 받기 때문이다.
 */
function useAdjacentMonthsPrefetch(
  ledgerId: string | undefined,
  year: number,
  month: number,
  currentMonthReady: boolean
) {
  const queryClient = useQueryClient();
  const { transactionService } = useServices();

  useEffect(() => {
    if (!ledgerId || !currentMonthReady) return;

    for (const offset of [-1, 1]) {
      const adjacent = addMonths(new Date(year, month - 1, 1), offset);
      const adjacentYear = adjacent.getFullYear();
      const adjacentMonth = adjacent.getMonth() + 1;
      const queryKey = queryKeys.monthlySummary.month(
        ledgerId,
        adjacentYear,
        adjacentMonth
      );
      if (queryClient.getQueryData(queryKey) !== undefined) continue;

      queryClient.prefetchQuery({
        queryKey,
        queryFn: () =>
          fetchMonthlyData(
            transactionService,
            ledgerId,
            adjacentYear,
            adjacentMonth
          ),
      });
    }
  }, [
    ledgerId,
    year,
    month,
    currentMonthReady,
    queryClient,
    transactionService,
  ]);
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
  const { loading, error, refetch } = useQueryStatus(query, !!ledgerId);

  useAdjacentMonthsPrefetch(ledgerId, year, month, query.isSuccess);

  return {
    // 다른 달의 값을 대신 보여주지 않는다. 새 달 데이터가 올 때까지는 비워둔다.
    calendarData: query.data?.calendarData ?? null,
    monthlySummary: query.data?.monthlySummary ?? null,
    // 홈 스플래시가 이 값을 기다린다
    loading,
    error,
    refetch,
  };
}
