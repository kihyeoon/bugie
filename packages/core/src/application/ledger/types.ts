import type { MemberRole } from '../../domain/ledger/types';

/**
 * 애플리케이션 레이어 입력 타입
 */

export interface CreateLedgerInput {
  name: string;
  description?: string;
  currency?: string;
}

export interface UpdateLedgerInput {
  ledgerId: string;
  name?: string;
  description?: string;
  currency?: string;
}

export interface InviteMemberInput {
  ledgerId: string;
  userEmail: string;
  role?: MemberRole;
}

export interface CreateInviteInput {
  ledgerId: string;
  role?: MemberRole;
  /** 최대 사용 횟수. 미지정이면 무제한 */
  maxUses?: number;
}

export interface DeleteCategoryResult {
  deleted: boolean;
  movedTransactions: number;
  fallbackCategoryName?: string;
}