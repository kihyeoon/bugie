// Service
export { TransactionService } from './TransactionService';

// Import for factory function
import { TransactionService } from './TransactionService';
import type { SupabaseClient } from '@supabase/supabase-js';

// Factory function
export function createTransactionService(
  supabase: SupabaseClient
): TransactionService {
  return new TransactionService(supabase);
}

// Types
export type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilter,
  MonthlySummary,
} from './types';
