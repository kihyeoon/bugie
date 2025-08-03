import { useState, useEffect, useCallback } from 'react';
import { useServices } from '../contexts/ServiceContext';
import { useLedger } from '../contexts/LedgerContext';
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
 * @returns 캘린더 컴포넌트용 데이터 (일(day)을 키로 사용)
 */
function transformToCalendarData(
  dailySummary: Record<string, unknown>
): CalendarTransaction {
  const calendarTransactions: CalendarTransaction = {};

  Object.entries(dailySummary).forEach(([dateStr, amounts]) => {
    // YYYY-MM-DD 형식에서 일(day) 숫자만 추출
    const day = parseInt(dateStr.split('-')[2], 10);

    // 타입 안전성을 위한 타입 단언
    const dayAmounts = amounts as { income: number; expense: number };

    // 수입이나 지출이 있는 날만 포함
    if (dayAmounts.income > 0 || dayAmounts.expense > 0) {
      calendarTransactions[day] = {
        income: dayAmounts.income,
        expense: dayAmounts.expense,
      };
    }
  });

  return calendarTransactions;
}

export function useMonthlyData(year: number, month: number): MonthlyDataResult {
  const { transactionService } = useServices();
  const { currentLedger } = useLedger();
  const [calendarData, setCalendarData] = useState<CalendarTransaction | null>(
    null
  );
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentLedger) {
      setCalendarData(null);
      setMonthlySummary(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const summary = await transactionService.getCalendarSummary(
        currentLedger.id,
        year,
        month
      );

      const calendarTransactions = transformToCalendarData(
        summary.dailySummary
      );

      setCalendarData(calendarTransactions);
      setMonthlySummary({
        income: summary.monthlyTotal.income,
        expense: summary.monthlyTotal.expense,
        balance: summary.monthlyTotal.balance,
      });
    } catch (err) {
      console.error('Failed to fetch monthly data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      setCalendarData(null);
      setMonthlySummary(null);
    } finally {
      setLoading(false);
    }
  }, [currentLedger, year, month, transactionService]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    calendarData,
    monthlySummary,
    loading,
    error,
    refetch: fetchData,
  };
}
