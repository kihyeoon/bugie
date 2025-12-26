import {
  createLedgerService,
  createTransactionService,
  createProfileService,
} from '@repo/core';
import { supabase } from '../../utils/supabase';
import type { CoreServices } from './types';

export function createCoreServices(): CoreServices {
  const ledgerService = createLedgerService(supabase);
  const transactionService = createTransactionService(supabase);
  const profileService = createProfileService(supabase);

  return {
    ledgerService,
    transactionService,
    profileService,
  };
}
