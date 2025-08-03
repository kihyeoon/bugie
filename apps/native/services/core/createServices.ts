import { createLedgerService, createTransactionService } from '@repo/core';
import { supabase } from '../../utils/supabase';
import type { CoreServices } from './types';

export function createCoreServices(): CoreServices {
  const ledgerService = createLedgerService(supabase);
  const transactionService = createTransactionService(supabase);

  return {
    ledgerService,
    transactionService,
  };
}
