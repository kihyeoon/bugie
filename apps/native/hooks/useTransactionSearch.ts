import { useMemo } from 'react';
import { partialMatchKey, useQuery } from '@tanstack/react-query';
import type { TransactionWithDetails } from '@repo/core';
import { useServices } from '../contexts/ServiceContext';
import { useLedger } from '../contexts/LedgerContext';
import { queryKeys } from '../utils/queryClient';
import { groupByDate } from '../utils/groupByDate';
import { useQueryStatus } from './useQueryStatus';

// 가장 큰 가계부도 401건(2026-09)이라 나눠 받지 않는다. 이어 받기를 두지 않는 이유는 설계 §5.4.
export const SEARCH_FETCH_LIMIT = 1000;

const NO_RESULTS: TransactionWithDetails[] = [];

/**
 * 현재 가계부의 전체 기간에서 제목·메모로 거래를 찾는다.
 * @param keyword normalizeKeyword로 정리된 값. 비어 있으면 조회하지 않는다.
 */
export function useTransactionSearch(keyword: string) {
  const { transactionService } = useServices();
  const { currentLedger } = useLedger();
  const ledgerId = currentLedger?.id;
  const isEnabled = !!ledgerId && keyword !== '';

  const query = useQuery({
    queryKey: queryKeys.transactions.search(ledgerId, keyword),
    queryFn: () =>
      transactionService.searchTransactions({
        ledgerId: ledgerId!,
        keyword,
        limit: SEARCH_FETCH_LIMIT,
      }),
    enabled: isEnabled,
    // 글자를 고치는 동안 이전 결과를 유지한다. 가계부가 바뀌었으면 이전 가계부 결과는 보이지 않는다.
    placeholderData: (previous, previousQuery) =>
      previousQuery &&
      partialMatchKey(
        previousQuery.queryKey,
        queryKeys.transactions.searchIn(ledgerId)
      )
        ? previous
        : undefined,
  });

  const results = query.data ?? NO_RESULTS;
  const sections = useMemo(() => groupByDate(results), [results]);
  const { loading, error, refetch } = useQueryStatus(query, isEnabled);

  return {
    results,
    sections,
    isPlaceholderData: query.isPlaceholderData,
    loading,
    error,
    refetch,
  };
}
