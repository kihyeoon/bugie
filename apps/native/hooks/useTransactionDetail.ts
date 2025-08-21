import { useState, useEffect, useCallback } from 'react';
import { useServices } from '../contexts/ServiceContext';
import type { TransactionWithDetails } from '@repo/core';

interface UseTransactionDetailReturn {
  transaction: TransactionWithDetails | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  deleteTransaction: () => Promise<void>;
}

export function useTransactionDetail(
  transactionId: string | undefined
): UseTransactionDetailReturn {
  const { transactionService } = useServices();
  const [transaction, setTransaction] = useState<TransactionWithDetails | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransaction = useCallback(async () => {
    if (!transactionId) {
      setError(new Error('거래 ID가 없습니다.'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await transactionService.getTransaction(transactionId);
      setTransaction(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('거래를 불러올 수 없습니다.')
      );
      setTransaction(null);
    } finally {
      setLoading(false);
    }
  }, [transactionId, transactionService]);

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
    fetchTransaction();
  }, [fetchTransaction]);

  return {
    transaction,
    loading,
    error,
    refetch: fetchTransaction,
    deleteTransaction,
  };
}
