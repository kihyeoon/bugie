import type { SectionListData } from 'react-native';
import type { TransactionWithDetails } from '@repo/core';

// SectionList에 그대로 넘길 수 있게 SectionListData를 확장
export interface GroupedTransaction
  extends SectionListData<TransactionWithDetails, { date: string }> {
  date: string;
  data: TransactionWithDetails[];
}

/**
 * 거래를 날짜별 섹션으로 묶는다. 날짜는 최신순, 같은 날짜 안은 받은 순서 그대로.
 * 매번 새 배열을 만드므로 호출하는 쪽에서 useMemo로 감싼다(목록 화면 effect가 참조 안정성에 기댄다).
 */
export function groupByDate(
  transactions: TransactionWithDetails[]
): GroupedTransaction[] {
  const grouped: Record<string, TransactionWithDetails[]> = {};

  transactions.forEach((transaction) => {
    const date = transaction.transaction_date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(transaction);
  });

  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ date, data }));
}
