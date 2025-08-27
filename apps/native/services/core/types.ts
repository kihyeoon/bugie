import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LedgerService, TransactionService, ProfileService } from '@repo/core';

export interface CoreServices {
  ledgerService: LedgerService;
  transactionService: TransactionService;
  profileService: ProfileService;
}

export interface ServiceConfig {
  supabase: SupabaseClient<Database>;
}
