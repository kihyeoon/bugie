import { useState, useEffect, useCallback } from 'react';
import { useServices } from '../contexts/ServiceContext';
import type { TransactionWithDetails, UpdateTransactionInput } from '@repo/core';

// 카테고리 정보를 포함한 확장된 UpdateTransactionInput
interface UpdateTransactionInputWithCategoryDetails extends UpdateTransactionInput {
  category_id?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

interface UseTransactionDetailReturn {
  transaction: TransactionWithDetails | null;
  loading: boolean;
  initialLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateTransaction: (updates: UpdateTransactionInputWithCategoryDetails) => Promise<void>;
  deleteTransaction: () => Promise<void>;
}

export function useTransactionDetail(
  transactionId: string | undefined
): UseTransactionDetailReturn {
  const { transactionService } = useServices();
  const [transaction, setTransaction] = useState<TransactionWithDetails | null>(
    null
  );
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransaction = useCallback(async (isInitial = false) => {
    if (!transactionId) {
      setError(new Error('거래 ID가 없습니다.'));
      setInitialLoading(false);
      return;
    }

    try {
      // 초기 로딩일 때만 initialLoading을 true로 설정
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      
      const data = await transactionService.getTransaction(transactionId);
      setTransaction(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('거래를 불러올 수 없습니다.')
      );
      setTransaction(null);
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [transactionId, transactionService]);

  const updateTransaction = useCallback(async (updates: UpdateTransactionInputWithCategoryDetails) => {
    if (!transactionId) {
      throw new Error('거래 ID가 없습니다.');
    }

    try {
      // 서버에는 기본 UpdateTransactionInput만 전송
      const serverUpdates: UpdateTransactionInput = {
        categoryId: updates.categoryId,
        amount: updates.amount,
        type: updates.type,
        title: updates.title,
        description: updates.description,
        transactionDate: updates.transactionDate,
      };
      
      await transactionService.updateTransaction(transactionId, serverUpdates);
      
      // 낙관적 업데이트 (UI에 즉시 반영)
      setTransaction(prev => {
        if (!prev) return prev;
        
        const { 
          categoryId, 
          transactionDate,
          category_id,
          category_name,
          category_color,
          category_icon,
          ...otherUpdates 
        } = updates;
        
        return {
          ...prev,
          ...otherUpdates,
          // 카테고리 ID가 변경되면 관련 필드도 업데이트
          ...(categoryId ? { 
            category_id: categoryId,
            // 카테고리 관련 정보는 transaction-detail에서 전달
            category_name: category_name || prev.category_name,
            category_color: category_color || prev.category_color,
            category_icon: category_icon || prev.category_icon,
          } : {}),
          // 날짜는 형식 맞춰서 업데이트
          transaction_date: transactionDate || prev.transaction_date,
        };
      });
      
      // 백그라운드에서 데이터 재검증 (로딩 화면 없이)
      fetchTransaction(false);
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error('거래를 수정할 수 없습니다.');
    }
  }, [transactionId, transactionService, fetchTransaction]);

  const deleteTransaction = async () => {
    if (!transactionId) {
      throw new Error('거래 ID가 없습니다.');
    }

    try {
      await transactionService.deleteTransaction(transactionId);
      // 삭제 성공 후 화면에서 처리
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error('거래를 삭제할 수 없습니다.');
    }
  };

  useEffect(() => {
    fetchTransaction(true); // 초기 로딩
  }, [fetchTransaction]);

  return {
    transaction,
    loading: initialLoading || isRefreshing, // 하위 호환성
    initialLoading,
    isRefreshing,
    error,
    refetch: () => fetchTransaction(false), // refetch는 백그라운드로
    updateTransaction,
    deleteTransaction,
  };
}
