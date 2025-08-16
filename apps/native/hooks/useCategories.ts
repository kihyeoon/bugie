import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import type { CategoryDetail } from '@repo/core';
import { useLedger } from '../contexts/LedgerContext';
import { useServices } from '../contexts/ServiceContext';

/**
 * 현재 선택된 가계부의 카테고리 목록을 가져오는 Hook
 * @param type - 'income' | 'expense' | undefined (전체)
 * @returns 카테고리 목록, 로딩 상태, 에러, 새로고침 함수, 수정/삭제 함수
 */
export function useCategories(type?: 'income' | 'expense') {
  const { currentLedger } = useLedger();
  const { ledgerService } = useServices();
  const [categories, setCategories] = useState<CategoryDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadCategories = useCallback(async () => {
    if (!currentLedger) {
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // LedgerService에서 카테고리 목록 가져오기
      const allCategories = await ledgerService.getCategories(currentLedger.id);

      // 타입별 필터링
      const filtered = type
        ? allCategories.filter((c) => c.type === type)
        : allCategories;

      setCategories(filtered);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError(
        err instanceof Error ? err : new Error('Failed to load categories')
      );
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [currentLedger, type, ledgerService]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  /**
   * 커스텀 카테고리 수정
   */
  const updateCategory = useCallback(
    async (
      categoryId: string,
      updates: { name: string; color: string; icon: string }
    ) => {
      try {
        await ledgerService.updateCategory(categoryId, updates);

        await loadCategories(); // 목록 새로고침
        Alert.alert('성공', '카테고리가 수정되었습니다.');
      } catch (err) {
        console.error('Failed to update category:', err);
        const errorMessage =
          err instanceof Error ? err.message : '카테고리 수정에 실패했습니다.';
        Alert.alert('오류', errorMessage);
        throw err;
      }
    },
    [ledgerService, loadCategories]
  );

  /**
   * 카테고리 삭제 (Soft Delete)
   */
  const deleteCategory = useCallback(
    async (categoryId: string) => {
      try {
        await ledgerService.deleteCategory(categoryId);

        // 목록에서 즉시 제거 (낙관적 업데이트)
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));

        Alert.alert('성공', '카테고리가 삭제되었습니다.');
        return true;
      } catch (err) {
        console.error('Failed to delete category:', err);
        const errorMessage =
          err instanceof Error ? err.message : '카테고리 삭제에 실패했습니다.';
        Alert.alert('오류', errorMessage);
        return false;
      }
    },
    [ledgerService]
  );

  return {
    categories,
    loading,
    error,
    refresh: loadCategories, // 새로고침 함수
    updateCategory, // 카테고리 수정 함수
    deleteCategory, // 카테고리 삭제 함수
  };
}
