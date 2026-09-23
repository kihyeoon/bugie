import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import type { PaymentMethodEntity, CreatePaymentMethodInput, UpdatePaymentMethodInput } from '@repo/core';
import { useLedger } from '../contexts/LedgerContext';
import { useServices } from '../contexts/ServiceContext';
import { useAuth } from '../contexts/AuthContext';
import { invalidateTransactionLists, queryKeys } from '../utils/queryClient';
import { useQueryStatus } from './useQueryStatus';

const NO_PAYMENT_METHODS: PaymentMethodEntity[] = [];

export interface OwnerGroup {
  ownerId: string;
  ownerName: string;
  methods: PaymentMethodEntity[];
}

interface GroupedPaymentMethods {
  shared: PaymentMethodEntity[];
  mine: PaymentMethodEntity[];
  othersByOwner: OwnerGroup[];
}

interface MemberInfo {
  user_id: string;
  full_name: string | null;
}

/** 결제 수단을 공동/내 수단/소유자별 수단으로 분류 */
export function groupPaymentMethods(
  methods: PaymentMethodEntity[],
  currentUserId: string | undefined,
  members?: MemberInfo[],
): GroupedPaymentMethods {
  const shared: PaymentMethodEntity[] = [];
  const mine: PaymentMethodEntity[] = [];
  const othersMap = new Map<string, PaymentMethodEntity[]>();

  for (const method of methods) {
    if (method.isShared) {
      shared.push(method);
    } else if (method.ownerId === currentUserId) {
      mine.push(method);
    } else if (method.ownerId) {
      const list = othersMap.get(method.ownerId) ?? [];
      list.push(method);
      othersMap.set(method.ownerId, list);
    }
  }

  const othersByOwner: OwnerGroup[] = Array.from(othersMap.entries()).map(
    ([ownerId, ownerMethods]) => {
      const member = members?.find((m) => m.user_id === ownerId);
      return {
        ownerId,
        ownerName: member?.full_name ?? '멤버',
        methods: ownerMethods,
      };
    }
  );

  return { shared, mine, othersByOwner };
}

/**
 * 현재 선택된 가계부의 결제 수단 목록을 관리하는 Hook
 * useCategories 패턴 기반 (로드, 낙관적 업데이트, 삭제)
 */
export function usePaymentMethods(ledgerIdParam?: string) {
  const { currentLedger } = useLedger();
  const { paymentMethodService } = useServices();
  const { user } = useAuth();

  const ledgerId = ledgerIdParam ?? currentLedger?.id;

  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.paymentMethods(ledgerId), [ledgerId]);

  const query = useQuery({
    queryKey,
    queryFn: () => paymentMethodService.getByLedger(ledgerId!),
    enabled: !!ledgerId,
  });

  const paymentMethods = query.data ?? NO_PAYMENT_METHODS;
  const { loading, error, refetch: refresh } = useQueryStatus(query, !!ledgerId);

  const create = useCallback(
    async (input: Omit<CreatePaymentMethodInput, 'ledgerId'>) => {
      if (!ledgerId) return;

      try {
        const id = await paymentMethodService.create({ ...input, ledgerId });

        // 낙관적 업데이트 — 서버에서 반환된 id로 임시 엔티티 추가
        const now = new Date();
        const newMethod: PaymentMethodEntity = {
          id,
          ledgerId,
          ownerId: input.ownerId ?? user?.id ?? null, // undefined(개인) → user.id, null(공동) → null
          isShared: input.isShared ?? false,
          name: input.name,
          icon: input.icon ?? 'credit-card',
          sortOrder: input.sortOrder ?? 0,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
        };
        queryClient.setQueryData<PaymentMethodEntity[]>(queryKey, (prev = []) => [...prev, newMethod]);
      } catch (err) {
        console.error('Failed to create payment method:', err);
        const message = err instanceof Error ? err.message : '결제 수단 추가에 실패했습니다.';
        Alert.alert('오류', message);
        throw err;
      }
    },
    [ledgerId, paymentMethodService, user, queryClient, queryKey]
  );

  const update = useCallback(
    async (id: string, input: UpdatePaymentMethodInput) => {
      const previous = queryClient.getQueryData<PaymentMethodEntity[]>(queryKey);

      // 낙관적 업데이트
      queryClient.setQueryData<PaymentMethodEntity[]>(queryKey, (prev = []) =>
        prev.map((m) => (m.id === id ? { ...m, ...input, updatedAt: new Date() } : m))
      );

      try {
        await paymentMethodService.update(id, input);
        // 거래 행에 결제 수단 이름이 조인돼 있다
        invalidateTransactionLists(queryClient);
      } catch (err) {
        console.error('Failed to update payment method:', err);
        queryClient.setQueryData(queryKey, previous);
        const message = err instanceof Error ? err.message : '결제 수단 수정에 실패했습니다.';
        Alert.alert('오류', message);
        throw err;
      }
    },
    [paymentMethodService, queryClient, queryKey]
  );

  const softDelete = useCallback(
    async (id: string) => {
      const method = paymentMethods.find((m) => m.id === id);
      if (!method) return false;

      return new Promise<boolean>((resolve) => {
        Alert.alert(
          '결제 수단 삭제',
          `"${method.name}"을(를) 삭제하시겠습니까?\n\n이 수단이 사용된 거래에서 결제 수단 정보가 사라집니다.`,
          [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            {
              text: '삭제',
              style: 'destructive',
              onPress: async () => {
                try {
                  await paymentMethodService.softDelete(id);
                  queryClient.setQueryData<PaymentMethodEntity[]>(queryKey, (prev = []) =>
                    prev.filter((m) => m.id !== id)
                  );
                  invalidateTransactionLists(queryClient);
                  resolve(true);
                } catch (err) {
                  console.error('Failed to delete payment method:', err);
                  const message = err instanceof Error ? err.message : '결제 수단 삭제에 실패했습니다.';
                  Alert.alert('오류', message);
                  resolve(false);
                }
              },
            },
          ]
        );
      });
    },
    [paymentMethods, paymentMethodService, queryClient, queryKey]
  );

  return {
    paymentMethods,
    loading,
    error,
    refresh,
    create,
    update,
    softDelete,
  };
}
