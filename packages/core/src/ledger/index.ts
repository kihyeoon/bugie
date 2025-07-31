// Service
export { LedgerService } from './LedgerService';

// Import for factory function
import { LedgerService } from './LedgerService';
import type { SupabaseClient } from '@supabase/supabase-js';

// Factory function
export function createLedgerService(supabase: SupabaseClient): LedgerService {
  return new LedgerService(supabase);
}

// Types
export type {
  CreateLedgerInput,
  UpdateLedgerInput,
  InviteMemberInput,
} from './types';