import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LedgerService, TransactionService, PaymentMethodService, ProfileService } from '@repo/core';

export interface CoreServices {
  ledgerService: LedgerService;
  transactionService: TransactionService;
  paymentMethodService: PaymentMethodService;
  profileService: ProfileService;
}

export interface ServiceConfig {
  supabase: SupabaseClient<Database>;
}
