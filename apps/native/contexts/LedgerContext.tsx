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
  const [currentLedger, setCurrentLedger] = useState<LedgerWithMembers | null>(null);
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
      
      const userLedgers = await ledgerService.getUserLedgers();
      setLedgers(userLedgers);

      // Load saved ledger ID
      const savedLedgerId = await AsyncStorage.getItem(CURRENT_LEDGER_KEY);
      
      if (savedLedgerId) {
        const savedLedger = userLedgers.find((l: LedgerWithMembers) => l.id === savedLedgerId);
        if (savedLedger) {
          setCurrentLedger(savedLedger);
        } else if (userLedgers.length > 0) {
          // Saved ledger not found, select first
          setCurrentLedger(userLedgers[0]);
          await AsyncStorage.setItem(CURRENT_LEDGER_KEY, userLedgers[0].id);
        }
      } else if (userLedgers.length > 0) {
        // No saved ledger, select first
        setCurrentLedger(userLedgers[0]);
        await AsyncStorage.setItem(CURRENT_LEDGER_KEY, userLedgers[0].id);
      }
    } catch (err) {
      console.error('Failed to load ledgers:', err);
      setError(err instanceof Error ? err : new Error('Failed to load ledgers'));
    } finally {
      setLoading(false);
    }
  }, [user, ledgerService]);

  const selectLedger = useCallback(async (ledgerId: string) => {
    const ledger = ledgers.find((l) => l.id === ledgerId);
    if (ledger) {
      setCurrentLedger(ledger);
      await AsyncStorage.setItem(CURRENT_LEDGER_KEY, ledgerId);
    }
  }, [ledgers]);

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