import { createLedgerService, createTransactionService } from '@repo/core';
import { createClient } from './supabase/client';

/**
 * 웹 앱에서 사용할 서비스 인스턴스들
 * 
 * 사용 예시:
 * ```typescript
 * import { ledgerService } from '@/lib/services';
 * 
 * const ledgers = await ledgerService.getUserLedgers();
 * ```
 */

// Supabase 클라이언트 생성
const supabase = createClient();

// 서비스 인스턴스 생성
export const ledgerService = createLedgerService(supabase);
export const transactionService = createTransactionService(supabase);