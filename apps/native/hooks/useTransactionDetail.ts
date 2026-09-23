import { useCallback, useMemo } from 'react';
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useServices } from '../contexts/ServiceContext';
import { invalidateTransactionLists, queryKeys } from '../utils/queryClient';
import { useQueryStatus } from './useQueryStatus';
import type {
  TransactionWithDetails,
  UpdateTransactionInput,
} from '@repo/core';

// 카테고리/지출자 정보를 포함한 확장된 UpdateTransactionInput
interface UpdateTransactionInputWithCategoryDetails
  extends UpdateTransactionInput {
  category_id?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  paid_by?: string;
  paid_by_name?: string | null;
  payment_method_id?: string | null;
  payment_method_name?: string | null;
  payment_method_icon?: string | null;
  payment_method_is_shared?: boolean | null;
}

interface UseTransactionDetailReturn {
  transaction: TransactionWithDetails | null;
  /** 보여줄 데이터 없이 처음 받는 중 */
  initialLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateTransaction: (
    updates: UpdateTransactionInputWithCategoryDetails
  ) => Promise<void>;
  deleteTransaction: () => Promise<void>;
}

function applyTransactionUpdates(
  prev: TransactionWithDetails,
  updates: UpdateTransactionInputWithCategoryDetails
): TransactionWithDetails {
  const {
    categoryId,
    paidBy,
    paymentMethodId,
    transactionDate,
    category_name,
    category_color,
    category_icon,
    paid_by,
    paid_by_name,
    payment_method_id,
    payment_method_name,
    payment_method_icon,
    payment_method_is_shared,
    ...otherUpdates
  } = updates;

  return {
    ...prev,
    ...otherUpdates,
    // 카테고리 ID가 변경되면 관련 필드도 업데이트
    ...(categoryId
      ? {
          category_id: categoryId,
          category_name: category_name || prev.category_name,
          category_color: category_color || prev.category_color,
          category_icon: category_icon || prev.category_icon,
        }
      : {}),
    // 지출자가 변경되면 관련 필드도 업데이트
    ...(paidBy
      ? {
          paid_by: paid_by || paidBy,
          paid_by_name:
            paid_by_name !== undefined ? paid_by_name : prev.paid_by_name,
        }
      : {}),
    // 결제 수단이 변경되면 관련 필드도 업데이트
    ...(paymentMethodId !== undefined
      ? {
          payment_method_id: payment_method_id ?? paymentMethodId ?? null,
          payment_method_name: payment_method_name ?? null,
          payment_method_icon: payment_method_icon ?? null,
          payment_method_is_shared: payment_method_is_shared ?? null,
        }
      : {}),
    // 날짜는 형식 맞춰서 업데이트
    transaction_date: transactionDate || prev.transaction_date,
  };
}

const MISSING_ID_ERROR = new Error('거래 ID가 없습니다.');

/** 홈·목록이 이미 받아둔 한 달치 행에서 같은 거래를 찾는다. 있으면 상세를 로딩 없이 바로 그린다. */
function findInTransactionLists(
  queryClient: QueryClient,
  transactionId: string | undefined
) {
  if (!transactionId) return undefined;

  for (const [queryKey, rows] of queryClient.getQueriesData<
    TransactionWithDetails[]
  >({ queryKey: queryKeys.transactions.all })) {
    const found = rows?.find((row) => row.id === transactionId);
    if (found) {
      return {
        transaction: found,
        updatedAt: queryClient.getQueryState(queryKey)?.dataUpdatedAt,
      };
    }
  }
  return undefined;
}

export function useTransactionDetail(
  transactionId: string | undefined
): UseTransactionDetailReturn {
  const { transactionService } = useServices();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.transaction(transactionId),
    [transactionId]
  );
  const cached = useMemo(
    () => findInTransactionLists(queryClient, transactionId),
    [queryClient, transactionId]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => transactionService.getTransaction(transactionId!),
    enabled: !!transactionId,
    initialData: cached?.transaction,
    initialDataUpdatedAt: cached?.updatedAt,
  });
  const { loading, error, refetch } = useQueryStatus(query, !!transactionId);

  const updateTransaction = useCallback(
    async (updates: UpdateTransactionInputWithCategoryDetails) => {
      if (!transactionId) {
        throw new Error('거래 ID가 없습니다.');
      }

      const previousTransaction =
        queryClient.getQueryData<TransactionWithDetails>(queryKey);
      const applyUpdates = () =>
        queryClient.setQueryData<TransactionWithDetails>(
          queryKey,
          (prev) => prev && applyTransactionUpdates(prev, updates)
        );
      const isPaidByUpdate = Boolean(updates.paidBy);
      const isPaymentMethodUpdate = updates.paymentMethodId !== undefined;

      // 지출자/결제 수단 변경은 서버 응답 전 화면을 먼저 갱신
      if (isPaidByUpdate || isPaymentMethodUpdate) {
        applyUpdates();
      }

      try {
        // 서버에는 기본 UpdateTransactionInput만 전송
        const serverUpdates: UpdateTransactionInput = {
          categoryId: updates.categoryId,
          paidBy: updates.paidBy,
          paymentMethodId: updates.paymentMethodId,
          amount: updates.amount,
          type: updates.type,
          title: updates.title,
          description: updates.description,
          transactionDate: updates.transactionDate,
        };

        await transactionService.updateTransaction(
          transactionId,
          serverUpdates
        );

        // 지출자/결제 수단 변경 외에는 기존 방식(서버 응답 후 상태 반영) 유지
        if (!isPaidByUpdate && !isPaymentMethodUpdate) {
          applyUpdates();
        }

        // 백그라운드에서 데이터 재검증 (로딩 화면 없이)
        queryClient.invalidateQueries({ queryKey });
        invalidateTransactionLists(queryClient);
      } catch (err) {
        // 지출자/결제 수단 낙관적 반영 실패 시 직전 상태로 롤백
        if (isPaidByUpdate || isPaymentMethodUpdate) {
          queryClient.setQueryData(queryKey, previousTransaction);
        }
        throw err instanceof Error
          ? err
          : new Error('거래를 수정할 수 없습니다.');
      }
    },
    [transactionId, transactionService, queryClient, queryKey]
  );

  const deleteTransaction = async () => {
    if (!transactionId) {
      throw new Error('거래 ID가 없습니다.');
    }

    try {
      await transactionService.deleteTransaction(transactionId);
      // 상세 쿼리는 지우지 않는다. 이 화면이 떠 있는 동안 지우면 삭제된 거래를 다시 받으려다 에러가 번쩍인다.
      invalidateTransactionLists(queryClient);
    } catch (err) {
      console.error('TransactionService deleteTransaction error:', err);
      throw err instanceof Error
        ? err
        : new Error('거래를 삭제할 수 없습니다.');
    }
  };

  return {
    transaction: query.data ?? null,
    initialLoading: loading,
    error: transactionId ? error : MISSING_ID_ERROR,
    refetch,
    updateTransaction,
    deleteTransaction,
  };
}
