import { useState, useEffect } from 'react';
import type { CategoryDetail } from '@repo/core';
import { useLedger } from '../contexts/LedgerContext';
import { useServices } from '../contexts/ServiceContext';

/**
 * 현재 선택된 가계부의 카테고리 목록을 가져오는 Hook
 * @param type - 'income' | 'expense' | undefined (전체)
 * @returns 카테고리 목록, 로딩 상태, 에러
 */
export function useCategories(type?: 'income' | 'expense') {
  const { currentLedger } = useLedger();
  const { ledgerService } = useServices();
  const [categories, setCategories] = useState<CategoryDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentLedger) {
      setCategories([]);
      setLoading(false);
      return;
    }

    const loadCategories = async () => {
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
    };

    loadCategories();
  }, [currentLedger, type, ledgerService]);

  return { categories, loading, error };
}