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
        ? allCategories.filter(c => c.type === type)
        : allCategories;
      
      setCategories(filtered);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError(err instanceof Error ? err : new Error('Failed to load categories'));
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
   * TODO: CategoryService 구현 후 교체 필요
   */
  const updateCategory = useCallback(async (
    categoryId: string,
    updates: { name: string; color: string; icon: string }
  ) => {
    if (!currentLedger) {
      throw new Error('가계부가 선택되지 않았습니다.');
    }

    try {
      // 임시로 직접 Supabase 호출
      const { supabase } = await import('../utils/supabase');
      const { error } = await supabase
        .from('categories')
        .update({
          name: updates.name,
          color: updates.color,
          icon: updates.icon,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryId);

      if (error) throw error;
      
      await loadCategories(); // 목록 새로고침
    } catch (err) {
      console.error('Failed to update category:', err);
      throw err;
    }
  }, [currentLedger, loadCategories]);

  /**
   * 카테고리 삭제 (Soft Delete)
   * TODO: CategoryService 구현 후 교체 필요
   */
  const deleteCategory = useCallback(async (categoryId: string) => {
    if (!currentLedger) {
      throw new Error('가계부가 선택되지 않았습니다.');
    }

    try {
      // 거래 존재 여부 확인
      const { supabase } = await import('../utils/supabase');
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id')
        .eq('ledger_id', currentLedger.id)
        .eq('category_id', categoryId)
        .is('deleted_at', null)
        .limit(1);

      if (transactions && transactions.length > 0) {
        Alert.alert(
          '삭제 불가',
          '이 카테고리를 사용하는 거래가 있습니다.\n거래를 먼저 삭제하거나 다른 카테고리로 변경해주세요.'
        );
        return false;
      }

      // 카테고리 삭제 (Soft Delete)
      const { error } = await supabase
        .from('categories')
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', categoryId);

      if (error) throw error;
      
      // 목록에서 즉시 제거 (낙관적 업데이트)
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      
      return true;
    } catch (err) {
      console.error('Failed to delete category:', err);
      throw err;
    }
  }, [currentLedger]);

  return { 
    categories, 
    loading, 
    error,
    refresh: loadCategories, // 새로고침 함수
    updateCategory, // 카테고리 수정 함수
    deleteCategory, // 카테고리 삭제 함수
  };
}