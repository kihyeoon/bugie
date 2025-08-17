/**
 * @repo/core - 비즈니스 로직과 도메인 레이어를 포함하는 코어 패키지
 */

// 도메인 레이어 Export
// 도메인 타입
export * from './domain/shared/types';
export * from './domain/shared/errors';
export * from './domain/auth/types';
export * from './domain/ledger/types';
export * from './domain/transaction/types';

// 도메인 규칙
export {
  LedgerRules,
  LedgerMemberRules,
  CategoryRules,
} from './domain/ledger/rules';
export { TransactionRules } from './domain/transaction/rules';

// 애플리케이션 레이어 Export
// 입력 타입
export type {
  CreateLedgerInput,
  UpdateLedgerInput,
  InviteMemberInput,
  DeleteCategoryResult,
} from './application/ledger/types';

export type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilterInput,
} from './application/transaction/types';

// UI/응답 타입
export type {
  LedgerWithMembers,
  LedgerDetail,
  CategoryDetail,
  TransactionWithDetails,
  CalendarDayData,
  CalendarData,
  CategorySummary,
  DailySummary,
} from './shared/types';

// 서비스 팩토리 함수
import type { SupabaseClient } from '@supabase/supabase-js';
import { LedgerService } from './application/ledger/LedgerService';
import { TransactionService } from './application/transaction/TransactionService';

// Infrastructure imports
import {
  LedgerRepository,
  LedgerMemberRepository,
  CategoryRepository,
} from './infrastructure/supabase/repositories/LedgerRepository';
import { TransactionRepository } from './infrastructure/supabase/repositories/TransactionRepository';
import { TransactionViewRepository } from './infrastructure/supabase/repositories/TransactionViewRepository';
import { SupabaseAuthService } from './infrastructure/supabase/auth/SupabaseAuthService';

export function createLedgerService(supabase: SupabaseClient): LedgerService {
  const ledgerRepo = new LedgerRepository(supabase);
  const memberRepo = new LedgerMemberRepository(supabase);
  const categoryRepo = new CategoryRepository(supabase);
  const authService = new SupabaseAuthService(supabase);
  const transactionRepo = new TransactionRepository(supabase);

  return new LedgerService(
    ledgerRepo,
    memberRepo,
    categoryRepo,
    authService,
    transactionRepo
  );
}

export function createTransactionService(
  supabase: SupabaseClient
): TransactionService {
  const transactionRepo = new TransactionRepository(supabase);
  const transactionViewRepo = new TransactionViewRepository(supabase);
  const memberRepo = new LedgerMemberRepository(supabase);
  const authService = new SupabaseAuthService(supabase);

  return new TransactionService(
    transactionRepo,
    memberRepo,
    authService,
    transactionViewRepo
  );
}

// 서비스 클래스 Export (타입용)
export type { LedgerService, TransactionService };
