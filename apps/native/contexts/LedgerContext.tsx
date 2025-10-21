import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LedgerWithMembers } from '@repo/core';
import { useServices } from './ServiceContext';
import { useAuth } from './AuthContext';

interface LedgerContextValue {
  currentLedger: LedgerWithMembers | null;
  ledgers: LedgerWithMembers[];
  loading: boolean;
  error: Error | null;
  refreshLedgers: () => Promise<void>;
  selectLedger: (ledgerId: string) => Promise<void>;
}

const LedgerContext = createContext<LedgerContextValue | undefined>(undefined);

const CURRENT_LEDGER_KEY = '@bugie/current_ledger_id';

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const { ledgerService } = useServices();
  const { user } = useAuth();
  const [currentLedger, setCurrentLedger] = useState<LedgerWithMembers | null>(
    null
  );
  const [ledgers, setLedgers] = useState<LedgerWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadLedgers = useCallback(async () => {
    if (!user) {
      setLedgers([]);
      setCurrentLedger(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // DB 쿼리와 AsyncStorage 읽기 병렬 실행
      const [userLedgers, savedLedgerId] = await Promise.all([
        ledgerService.getUserLedgers(),
        AsyncStorage.getItem(CURRENT_LEDGER_KEY),
      ]);

      setLedgers(userLedgers);

      // 저장된 가계부 찾기
      let selectedLedger: LedgerWithMembers | null = null;

      if (savedLedgerId) {
        const savedLedger = userLedgers.find(
          (l: LedgerWithMembers) => l.id === savedLedgerId
        );
        if (savedLedger) {
          selectedLedger = savedLedger;
        } else if (userLedgers.length > 0) {
          // 저장된 가계부를 찾을 수 없으면 첫 번째 선택
          selectedLedger = userLedgers[0];
        }
      } else if (userLedgers.length > 0) {
        // 저장된 ID가 없으면 첫 번째 선택
        selectedLedger = userLedgers[0];
      }

      // 선택된 가계부 설정 (UI 즉시 업데이트)
      setCurrentLedger(selectedLedger);
      setLoading(false);

      // AsyncStorage 쓰기는 비블로킹 (백그라운드)
      if (selectedLedger && selectedLedger.id !== savedLedgerId) {
        AsyncStorage.setItem(CURRENT_LEDGER_KEY, selectedLedger.id).catch(
          (err) => {
            console.warn('Failed to save current ledger ID:', err);
          }
        );
      }
    } catch (err) {
      console.error('Failed to load ledgers:', err);
      setError(
        err instanceof Error ? err : new Error('Failed to load ledgers')
      );
      setLoading(false);
    }
  }, [user, ledgerService]);

  const selectLedger = useCallback(
    async (ledgerId: string) => {
      const ledger = ledgers.find((l) => l.id === ledgerId);
      if (ledger) {
        setCurrentLedger(ledger);
        await AsyncStorage.setItem(CURRENT_LEDGER_KEY, ledgerId);
      }
    },
    [ledgers]
  );

  const refreshLedgers = useCallback(async () => {
    await loadLedgers();
  }, [loadLedgers]);

  useEffect(() => {
    loadLedgers();
  }, [loadLedgers]);

  const value: LedgerContextValue = {
    currentLedger,
    ledgers,
    loading,
    error,
    refreshLedgers,
    selectLedger,
  };

  return (
    <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>
  );
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (context === undefined) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return context;
}
