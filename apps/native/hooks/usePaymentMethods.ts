import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import type { PaymentMethodEntity, CreatePaymentMethodInput, UpdatePaymentMethodInput } from '@repo/core';
import { useLedger } from '../contexts/LedgerContext';
import { useServices } from '../contexts/ServiceContext';
import { useAuth } from '../contexts/AuthContext';

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

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadPaymentMethods = useCallback(async () => {
    if (!ledgerId) {
      setPaymentMethods([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await paymentMethodService.getByLedger(ledgerId);
      setPaymentMethods(data);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      setError(err instanceof Error ? err : new Error('결제 수단을 불러올 수 없습니다.'));
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  }, [ledgerId, paymentMethodService]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

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
        setPaymentMethods((prev) => [...prev, newMethod]);
      } catch (err) {
        console.error('Failed to create payment method:', err);
        const message = err instanceof Error ? err.message : '결제 수단 추가에 실패했습니다.';
        Alert.alert('오류', message);
        throw err;
      }
    },
    [ledgerId, paymentMethodService, user]
  );

  const update = useCallback(
    async (id: string, input: UpdatePaymentMethodInput) => {
      const previous = [...paymentMethods];

      // 낙관적 업데이트
      setPaymentMethods((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...input, updatedAt: new Date() } : m))
      );

      try {
        await paymentMethodService.update(id, input);
      } catch (err) {
        console.error('Failed to update payment method:', err);
        setPaymentMethods(previous);
        const message = err instanceof Error ? err.message : '결제 수단 수정에 실패했습니다.';
        Alert.alert('오류', message);
        throw err;
      }
    },
    [paymentMethods, paymentMethodService]
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
                  setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
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
    [paymentMethods, paymentMethodService]
  );

  return {
    paymentMethods,
    loading,
    error,
    refresh: loadPaymentMethods,
    create,
    update,
    softDelete,
  };
}
