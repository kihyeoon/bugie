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
export * from './domain/profile/types';

// 도메인 규칙
export {
  LedgerRules,
  LedgerMemberRules,
  CategoryRules,
} from './domain/ledger/rules';
export { TransactionRules } from './domain/transaction/rules';
export { ProfileRules } from './domain/profile/rules';

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

export type {
  UpdateProfileInput,
  DeleteAccountInput,
  ProfileDetail,
} from './application/profile/types';

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
import { ProfileService } from './application/profile/ProfileService';

// Infrastructure imports
import {
  LedgerRepository,
  LedgerMemberRepository,
  CategoryRepository,
} from './infrastructure/supabase/repositories/LedgerRepository';
import { TransactionRepository } from './infrastructure/supabase/repositories/TransactionRepository';
import { TransactionViewRepository } from './infrastructure/supabase/repositories/TransactionViewRepository';
import { SupabaseAuthService } from './infrastructure/supabase/auth/SupabaseAuthService';
import { SupabaseProfileRepository } from './infrastructure/supabase/profile/SupabaseProfileRepository';

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

export function createProfileService(
  supabase: SupabaseClient
): ProfileService {
  const profileRepo = new SupabaseProfileRepository(supabase);
  const ledgerRepo = new LedgerRepository(supabase);
  const authService = new SupabaseAuthService(supabase);

  return new ProfileService(
    profileRepo,
    ledgerRepo,
    authService
  );
}

// 서비스 클래스 Export (타입용)
export type { LedgerService, TransactionService, ProfileService };

// 권한 관리 서비스 Export
export { PermissionService } from './application/permission/PermissionService';

// AuthService Export (네이티브 앱에서 사용)
export { SupabaseAuthService } from './infrastructure/supabase/auth/SupabaseAuthService';
