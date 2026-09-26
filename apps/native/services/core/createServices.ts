import {
  createLedgerService,
  createTransactionService,
  createPaymentMethodService,
  createProfileService,
  createAppVersionService,
} from '@repo/core';
import { supabase } from '../../utils/supabase';
import type { CoreServices } from './types';

export function createCoreServices(): CoreServices {
  const ledgerService = createLedgerService(supabase);
  const transactionService = createTransactionService(supabase);
  const paymentMethodService = createPaymentMethodService(supabase);
  const profileService = createProfileService(supabase);
  const appVersionService = createAppVersionService(supabase);

  return {
    ledgerService,
    transactionService,
    paymentMethodService,
    profileService,
    appVersionService,
  };
}
