import { useCallback, useEffect, useMemo } from 'react';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import type { CategoryDetail, LedgerService } from '@repo/core';
import { useLedger } from '../contexts/LedgerContext';
import { useServices } from '../contexts/ServiceContext';
import { invalidateTransactionLists, queryKeys } from '../utils/queryClient';
import { useQueryStatus } from './useQueryStatus';

const NO_CATEGORIES: CategoryDetail[] = [];

// 미리 받기와 useQuery가 같은 키에 같은 방법으로 받도록 한 곳에서 정의한다.
function categoriesQuery(
  ledgerService: LedgerService,
  ledgerId: string | undefined
) {
  return queryOptions({
    queryKey: queryKeys.categories(ledgerId),
    queryFn: () => ledgerService.getCategories(ledgerId!),
  });
}

/**
 * 빠른입력·거래 상세에 처음 들어갈 때 카테고리가 이미 캐시에 있도록 미리 받아 둔다.
 * 홈 첫 화면을 늦추지 않도록 호출하는 쪽이 준비된 뒤(ready)에만 받는다.
 */
export function usePrefetchCategories(ready: boolean) {
  const { currentLedger } = useLedger();
  const { ledgerService } = useServices();
  const queryClient = useQueryClient();
  const ledgerId = currentLedger?.id;

  useEffect(() => {
    if (!ledgerId || !ready) return;
    // 캐시에 있으면 받지 않는다. 신선도는 빠른입력이 포커스 때 재조회해 챙긴다.
    // 실패해도 빠른입력이 다시 받으므로 무시한다.
    queryClient
      .ensureQueryData(categoriesQuery(ledgerService, ledgerId))
      .catch(() => undefined);
  }, [ledgerId, ready, queryClient, ledgerService]);
}

/**
 * 현재 선택된 가계부의 카테고리 목록을 가져오는 Hook
 * @param type - 'income' | 'expense' | undefined (전체)
 * @returns 카테고리 목록, 로딩 상태, 에러, 새로고침 함수, 수정/삭제 함수
 */
export function useCategories(type?: 'income' | 'expense') {
  const { currentLedger } = useLedger();
  const { ledgerService } = useServices();
  const queryClient = useQueryClient();
  const ledgerId = currentLedger?.id;
  const options = useMemo(
    () => categoriesQuery(ledgerService, ledgerId),
    [ledgerService, ledgerId]
  );
  const { queryKey } = options;

  // 수입/지출 필터는 한 캐시에서 골라낸다. 타입마다 따로 받으면 같은 목록을 두 번 받는다.
  const selectByType = useCallback(
    (all: CategoryDetail[]) =>
      type ? all.filter((c) => c.type === type) : all,
    [type]
  );

  const query = useQuery({
    ...options,
    enabled: !!ledgerId,
    select: selectByType,
  });

  const categories = query.data ?? NO_CATEGORIES;
  const {
    loading,
    error,
    refetch: refresh,
  } = useQueryStatus(query, !!ledgerId);

  /**
   * 커스텀 카테고리 수정
   */
  const updateCategory = useCallback(
    async (
      categoryId: string,
      updates: { name: string; color: string; icon: string }
    ) => {
      // 이전 상태 백업 (롤백용)
      const previousCategories =
        queryClient.getQueryData<CategoryDetail[]>(queryKey) ?? [];

      // 낙관적 업데이트 - UI 즉시 반영
      queryClient.setQueryData<CategoryDetail[]>(queryKey, (prev = []) =>
        prev.map((cat) =>
          cat.id === categoryId ? { ...cat, ...updates } : cat
        )
      );

      try {
        await ledgerService.updateCategory(categoryId, updates);
        // 거래 행에 카테고리 이름·색이 조인돼 있다
        invalidateTransactionLists(queryClient);

        Alert.alert('성공', '카테고리가 수정되었습니다.');
      } catch (err) {
        console.error('Failed to update category:', err);

        // 실패 시 롤백
        queryClient.setQueryData(queryKey, previousCategories);

        const errorMessage =
          err instanceof Error ? err.message : '카테고리 수정에 실패했습니다.';
        Alert.alert('오류', errorMessage);
        throw err;
      }
    },
    [ledgerService, queryClient, queryKey]
  );

  /**
   * 카테고리 삭제 (Soft Delete)
   * 연결된 거래가 있으면 기본 카테고리로 이전됨을 알림
   */
  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      if (!category) return false;

      const categoryTypeName =
        category.type === 'income' ? '기타수입' : '기타지출';

      return new Promise<boolean>((resolve) => {
        Alert.alert(
          '카테고리 삭제',
          `이 카테고리를 삭제하시겠습니까?\n\n이 카테고리에 연결된 거래가 있다면 "${categoryTypeName}" 카테고리로 자동 이동됩니다.`,
          [
            {
              text: '취소',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: '삭제',
              style: 'destructive',
              onPress: async () => {
                try {
                  await ledgerService.deleteCategory(categoryId);
                  // 연결된 거래가 기타 카테고리로 옮겨졌다
                  invalidateTransactionLists(queryClient);

                  // 목록에서 즉시 제거 (낙관적 업데이트)
                  queryClient.setQueryData<CategoryDetail[]>(
                    queryKey,
                    (prev = []) => prev.filter((c) => c.id !== categoryId)
                  );

                  resolve(true);
                } catch (err) {
                  console.error('Failed to delete category:', err);
                  const errorMessage =
                    err instanceof Error
                      ? err.message
                      : '카테고리 삭제에 실패했습니다.';
                  Alert.alert('오류', errorMessage);
                  resolve(false);
                }
              },
            },
          ]
        );
      });
    },
    [categories, ledgerService, queryClient, queryKey]
  );

  return {
    categories,
    loading,
    error,
    refresh, // 새로고침 함수
    updateCategory, // 카테고리 수정 함수
    deleteCategory, // 카테고리 삭제 함수
  };
}
